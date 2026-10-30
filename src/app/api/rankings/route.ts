import { NextRequest } from 'next/server';
import { fetchAllRankings, RankingsData } from '@/services/eurostat-rankings';
import { checkRateLimit } from '@/lib/api-guard';
import { getRequestDemoMode, shouldFallbackToSnapshot, shouldUseSnapshot } from '@/lib/demo-mode';
import { getAggregateSourceHealth, makeProvenanceList } from '@/lib/source-registry';
import { jsonWithRequestId } from '@/lib/request-id';
import rankingsSnapshot from '@/data/demo/rankings.json';

interface RankingsMeta {
  fetchedAt: string;
  methodologyVersion: 'v2';
  coveragePct: number;
  freshness: 'live' | 'cached' | 'stale' | 'snapshot';
  sourceHealth: 'ok' | 'degraded';
}

let cache: { data: RankingsData; timestamp: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

function coveragePct(data: RankingsData): number {
  if (data.indicators.length === 0) return 0;
  const total = data.indicators.reduce((acc, indicator) => acc + indicator.entries.length, 0);
  const withData = data.indicators.reduce((acc, indicator) => acc + indicator.countriesWithData, 0);
  return total > 0 ? Math.round((withData / total) * 1000) / 10 : 0;
}

function withMeta(data: RankingsData, freshness: RankingsMeta['freshness']) {
  const meta: RankingsMeta = {
    fetchedAt: data.fetchedAt,
    methodologyVersion: 'v2',
    coveragePct: coveragePct(data),
    freshness,
    sourceHealth: getAggregateSourceHealth(['eurostat']),
  };

  return {
    ...data,
    meta,
    provenance: makeProvenanceList(['eurostat'], freshness, data.fetchedAt),
  };
}

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-rankings', max: 60, windowMs: 60_000 });
  if (limited) return limited;

  const demoMode = getRequestDemoMode(req);
  if (shouldUseSnapshot(demoMode)) {
    const snapshotData = rankingsSnapshot as RankingsData;
    return jsonWithRequestId(req, withMeta(snapshotData, 'snapshot'));
  }

  const now = Date.now();

  if (cache && (now - cache.timestamp) < CACHE_TTL) {
    return jsonWithRequestId(req, withMeta(cache.data, 'cached'));
  }

  try {
    const data = await fetchAllRankings();
    // fetchAllRankings swallows per-indicator failures, so a full outage resolves empty.
    // Treat that as a failure instead of caching an empty ranking for 6 hours.
    if (data.indicators.length === 0) throw new Error('No ranking indicators fetched');
    cache = { data, timestamp: now };
    return jsonWithRequestId(req, withMeta(data, 'live'));
  } catch (error) {
    console.error('Rankings API error:', error);

    if (cache) {
      return jsonWithRequestId(req, withMeta(cache.data, 'stale'));
    }

    if (shouldFallbackToSnapshot(demoMode)) {
      const snapshotData = rankingsSnapshot as RankingsData;
      return jsonWithRequestId(req, withMeta(snapshotData, 'snapshot'));
    }

    return jsonWithRequestId(req, { error: 'Failed to fetch rankings data' }, 500);
  }
}
