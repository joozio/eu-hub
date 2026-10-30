import { GuardError } from './model-guard';

const URLS = [
  'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml',
  'https://ec.europa.eu/commission/presscorner/api/rss?language=en',
];
export const RSS_LIMITS = Object.freeze({ bytes: 1048576, timeoutMs: 8000, waiters: 32, cacheMs: 1800000 });

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new GuardError(408, 'Feed request canceled'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function readFeed(url: string, signal: AbortSignal): Promise<string> {
  const response = await abortable(fetch(url, { signal, redirect: 'error', cache: 'no-store' }), signal);
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > RSS_LIMITS.bytes) {
    void response.body?.cancel().catch(() => {});
    throw new GuardError(502, 'Feed response unavailable or too large');
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder(); let bytes = 0; let text = '';
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (signal.aborted) throw signal.reason;
      if (done) break;
      bytes += value.byteLength;
      if (bytes > RSS_LIMITS.bytes) throw new GuardError(502, 'Feed response too large');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { signal.removeEventListener('abort', cancel); cancel(); }
}

// One job, at most two upstream requests and 32 waiting callers per server process.
// Both quick/full routes share this public raw cache. No personalized data lives here.
export function createRSSLoader() {
  let cached: { texts: string[]; until: number } | undefined;
  let active: { controller: AbortController; promise: Promise<string[]>; waiters: number } | undefined;
  return (caller: AbortSignal): Promise<string[]> => {
    if (caller.aborted) return Promise.reject(new GuardError(408, 'Feed request canceled'));
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.texts);
    if (active && active.waiters >= RSS_LIMITS.waiters) return Promise.reject(new GuardError(429, 'Feed service busy'));
    if (!active) {
      const controller = new AbortController();
      const job = { controller, promise: Promise.resolve([] as string[]), waiters: 0 };
      active = job;
      const timer = setTimeout(() => controller.abort(new GuardError(504, 'Feed request timed out')), RSS_LIMITS.timeoutMs);
      job.promise = Promise.allSettled(URLS.map(url => readFeed(url, controller.signal))).then(results => {
        if (controller.signal.aborted) throw controller.signal.reason;
        const texts = results.map(result => result.status === 'fulfilled' ? result.value : '');
        if (!texts.some(Boolean)) throw new GuardError(502, 'Feed sources unavailable');
        cached = { texts, until: Date.now() + RSS_LIMITS.cacheMs };
        return texts;
      }).finally(() => { clearTimeout(timer); if (active === job) active = undefined; });
    }
    const job = active;
    job.waiters++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true; caller.removeEventListener('abort', abort); job.waiters--;
        if (job.waiters === 0) job.controller.abort(new GuardError(408, 'Feed request canceled'));
        return true;
      };
      const abort = () => { if (finish()) reject(new GuardError(408, 'Feed request canceled')); };
      caller.addEventListener('abort', abort, { once: true });
      job.promise.then(value => { if (finish()) resolve(value); }, error => { if (finish()) reject(error); });
      if (caller.aborted) abort();
    });
  };
}
export const loadRSS = createRSSLoader();
