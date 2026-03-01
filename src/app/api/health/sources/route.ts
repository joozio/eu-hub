import { NextRequest } from 'next/server';
import { checkRateLimit, fetchWithTimeout } from '@/lib/api-guard';
import { getAllSourceHealth, listSourceDefinitions, markSourceDegraded, markSourceFailure, markSourceSuccess } from '@/lib/source-registry';
import { jsonWithRequestId } from '@/lib/request-id';

async function probe(url: string, headers?: Record<string, string>): Promise<number> {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store', headers }, 6000);
  if (!response.ok) throw new Error(`Probe failed with status ${response.status}`);
  return Date.now() - startedAt;
}

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-health-sources', max: 20, windowMs: 60_000 });
  if (limited) return limited;

  const definitions = listSourceDefinitions();
  const apiKey = process.env.MISTRAL_API_KEY;

  await Promise.allSettled([
    probe('https://ec.europa.eu/eurostat').then((latency) => markSourceSuccess('eurostat', latency)).catch(() => markSourceFailure('eurostat')),
    probe('https://www.europarl.europa.eu/rss/doc/press-releases/en.xml').then((latency) => markSourceSuccess('ep_rss', latency)).catch(() => markSourceFailure('ep_rss')),
    probe('https://ec.europa.eu/commission/presscorner/api/rss?language=en').then((latency) => markSourceSuccess('ec_presscorner', latency)).catch(() => markSourceFailure('ec_presscorner')),
    apiKey
      ? probe('https://api.mistral.ai/v1/models', { Authorization: `Bearer ${apiKey}` })
        .then((latency) => markSourceSuccess('mistral', latency))
        .catch(() => markSourceFailure('mistral'))
      : Promise.resolve(markSourceDegraded('mistral')),
  ]);

  const health = getAllSourceHealth().map((item) => ({
    ...item,
    sourceName: definitions.find((d) => d.id === item.sourceId)?.name || item.sourceId,
  }));

  return jsonWithRequestId(req, {
    generatedAt: new Date().toISOString(),
    sources: health,
  });
}
