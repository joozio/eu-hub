import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { isIP } from 'node:net';

// Fixed conservative ceilings; no caller-controlled overrides. Reservations are never refunded.
export const LIMITS = Object.freeze({ body: 16384, requestMs: 5000, upstreamMs: 20000,
  response: 131072, promptBytes: 20000, dailyRequests: 100, dailyTokens: 250000,
  clientRequests: 12, clientTokens: 50000, concurrent: 2, clientConcurrent: 1 });
export class GuardError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const context = new AsyncLocalStorage<{ client: string; signal: AbortSignal }>();
type Counter = { requests: number; tokens: number };
type Ledger = { day: string; total: Counter; clients: Record<string, Counter>;
  leases: Record<string, { client: string; until: number }> };

// This deployment listens ONLY on loopback, behind nginx's overwritten X-Real-IP.
// Never use X-Forwarded-For, Forwarded, cookies, country, or profile as quota identity.
export function clientKey(req: Request) {
  const ip = req.headers.get('x-real-ip') || '';
  return createHash('sha256').update(isIP(ip) ? ip : 'unidentified').digest('hex');
}
export function guarded<T extends Request>(handler: (req: T) => Promise<Response>) {
  return async (req: T) => {
    try { return await context.run({ client: clientKey(req), signal: req.signal }, () => handler(req)); }
    catch (e) {
      const known = e instanceof GuardError;
      return Response.json({ error: known ? e.message : 'Service temporarily unavailable' },
        { status: known ? e.status : 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
function ledger<T>(change: (state: Ledger) => T): T {
  const dir = process.env.EU_HUB_BUDGET_DIR || join(process.cwd(), '.model-budget');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, 'lock');
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch { throw new GuardError(503, 'Budget accounting busy'); }
  try {
    const path = join(dir, 'ledger.json');
    const day = new Date().toISOString().slice(0, 10);
    let state: Ledger;
    try { state = JSON.parse(readFileSync(path, 'utf8')); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new GuardError(503, 'Budget accounting unavailable');
      state = { day, total: { requests: 0, tokens: 0 }, clients: {}, leases: {} };
    }
    if (!state || typeof state.day !== 'string' || !state.total || !state.clients || !state.leases ||
      !Number.isSafeInteger(state.total.requests) || !Number.isSafeInteger(state.total.tokens)) {
      throw new GuardError(503, 'Budget accounting unavailable');
    }
    // Never reset on a clock rollback; only a new UTC day can replenish the budget.
    if (day > state.day) state = { day, total: { requests: 0, tokens: 0 }, clients: {}, leases: state.leases };
    for (const [key, lease] of Object.entries(state.leases)) if (lease.until < Date.now()) delete state.leases[key];
    const result = change(state);
    const temp = join(dir, `ledger-${randomUUID()}.tmp`);
    writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, path);
    const directory = openSync(dir, 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
    return result;
  } finally { rmSync(lock, { recursive: true }); }
}
function reserve(tokens: number) {
  const client = context.getStore()?.client || 'internal';
  const id = randomUUID();
  ledger(state => {
    const own = state.clients[client] || { requests: 0, tokens: 0 };
    const leases = Object.values(state.leases);
    if (leases.length >= LIMITS.concurrent || leases.filter(l => l.client === client).length >= LIMITS.clientConcurrent)
      throw new GuardError(429, 'AI service busy; please try later');
    if (state.total.requests >= LIMITS.dailyRequests || state.total.tokens + tokens > LIMITS.dailyTokens ||
      own.requests >= LIMITS.clientRequests || own.tokens + tokens > LIMITS.clientTokens)
      throw new GuardError(429, 'Daily AI allowance reached; please try tomorrow');
    state.total.requests++; state.total.tokens += tokens;
    own.requests++; own.tokens += tokens; state.clients[client] = own;
    state.leases[id] = { client, until: Date.now() + 45000 };
  });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // A failed cleanup stays conservatively occupied until the lease expires.
    try { ledger(state => { delete state.leases[id]; }); } catch { /* fail closed */ }
  };
}
async function limitedRead(body: ReadableStream<Uint8Array> | null, max: number, signal: AbortSignal) {
  if (!body) return new Uint8Array();
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new GuardError(408, 'Request timed out');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new GuardError(408, 'Request timed out');
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new GuardError(413, 'Payload too large');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); }
}
export async function readJSON(req: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) throw new GuardError(415, 'Expected JSON');
  if (req.headers.get('content-encoding') && req.headers.get('content-encoding') !== 'identity') throw new GuardError(415, 'Unsupported encoding');
  const length = req.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMITS.body)) throw new GuardError(413, 'Payload too large');
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(LIMITS.requestMs)]);
  try {
    const bytes = await limitedRead(req.body, LIMITS.body, signal);
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch (e) { if (e instanceof GuardError) throw e; throw new GuardError(400, 'Invalid JSON object'); }
}

// Every paid call, including legacy/internal callers, must pass through here.
export async function modelFetch(_url: string, options: RequestInit): Promise<Response> {
  const body = JSON.parse(String(options.body));
  const promptBytes = Buffer.byteLength(JSON.stringify(body.messages));
  if (promptBytes > LIMITS.promptBytes || !Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 3000)
    throw new GuardError(413, 'Model input too large');
  // UTF-8 byte count + framing allowance conservatively bounds input tokens.
  const release = reserve(promptBytes + 512 + body.max_tokens);
  const aborter = new AbortController();
  const caller = context.getStore()?.signal;
  const onAbort = () => finish();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    clearTimeout(timer); caller?.removeEventListener('abort', onAbort); aborter.abort();
    void reader?.cancel().catch(() => {}); release();
  };
  const timer = setTimeout(finish, LIMITS.upstreamMs);
  caller?.addEventListener('abort', onAbort, { once: true });
  try {
    if (caller?.aborted) throw new GuardError(408, 'Request canceled');
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', { ...options, signal: aborter.signal, redirect: 'error' });
    if (Number(response.headers.get('content-length') || 0) > LIMITS.response) { void response.body?.cancel(); throw new GuardError(502, 'AI response too large'); }
    if (!response.ok || !response.body) { void response.body?.cancel(); throw new GuardError(502, 'AI upstream unavailable'); }
    if (!body.stream) {
      const bytes = await limitedRead(response.body, LIMITS.response, aborter.signal);
      return new Response(bytes, { headers: { 'Content-Type': 'application/json' } });
    }
    reader = response.body.getReader(); let count = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader!.read();
          if (aborter.signal.aborted) throw new GuardError(504, 'AI response timed out');
          if (done) { finish(); controller.close(); return; }
          count += value.length;
          if (count > LIMITS.response) throw new GuardError(502, 'AI response too large');
          controller.enqueue(value);
        } catch { finish(); controller.error(new Error('AI stream ended')); }
      },
      cancel() { finish(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  } catch (e) { finish(); throw e instanceof GuardError ? e : new GuardError(502, 'AI upstream unavailable'); }
  finally { if (!body.stream) finish(); }
}
