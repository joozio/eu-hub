import { FreshnessMode, ProvenanceRef, SourceHealth, SourceId } from '@/types';

interface SourceDefinition {
  id: SourceId;
  name: string;
  homepageUrl: string;
  staleAfterMs: number;
}

interface SourceHealthInternal {
  sourceId: SourceId;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
}

const SOURCE_REGISTRY: Record<SourceId, SourceDefinition> = {
  eurostat: {
    id: 'eurostat',
    name: 'Eurostat',
    homepageUrl: 'https://ec.europa.eu/eurostat',
    staleAfterMs: 12 * 60 * 60 * 1000,
  },
  ep_rss: {
    id: 'ep_rss',
    name: 'European Parliament RSS',
    homepageUrl: 'https://www.europarl.europa.eu/rss',
    staleAfterMs: 2 * 60 * 60 * 1000,
  },
  ec_presscorner: {
    id: 'ec_presscorner',
    name: 'European Commission Press Corner',
    homepageUrl: 'https://ec.europa.eu/commission/presscorner/home/en',
    staleAfterMs: 2 * 60 * 60 * 1000,
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral API',
    homepageUrl: 'https://docs.mistral.ai/',
    staleAfterMs: 60 * 60 * 1000,
  },
};

const sourceHealth = new Map<SourceId, SourceHealthInternal>(
  (Object.keys(SOURCE_REGISTRY) as SourceId[]).map((sourceId) => [
    sourceId,
    {
      sourceId,
      status: 'degraded',
      latencyMs: null,
      lastSuccessAt: null,
      lastErrorAt: null,
    },
  ])
);

export function getSourceDefinition(sourceId: SourceId): SourceDefinition {
  return SOURCE_REGISTRY[sourceId];
}

export function listSourceDefinitions(): SourceDefinition[] {
  return Object.values(SOURCE_REGISTRY);
}

export function markSourceSuccess(sourceId: SourceId, latencyMs: number): void {
  const current = sourceHealth.get(sourceId);
  sourceHealth.set(sourceId, {
    sourceId,
    status: latencyMs > 3500 ? 'degraded' : 'ok',
    latencyMs: Math.max(0, Math.round(latencyMs)),
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: current?.lastErrorAt || null,
  });
}

export function markSourceFailure(sourceId: SourceId): void {
  const current = sourceHealth.get(sourceId);
  sourceHealth.set(sourceId, {
    sourceId,
    status: 'down',
    latencyMs: current?.latencyMs ?? null,
    lastSuccessAt: current?.lastSuccessAt ?? null,
    lastErrorAt: new Date().toISOString(),
  });
}

export function markSourceDegraded(sourceId: SourceId, latencyMs: number | null = null): void {
  const current = sourceHealth.get(sourceId);
  sourceHealth.set(sourceId, {
    sourceId,
    status: 'degraded',
    latencyMs: latencyMs ?? current?.latencyMs ?? null,
    lastSuccessAt: current?.lastSuccessAt ?? null,
    lastErrorAt: current?.lastErrorAt ?? null,
  });
}

export function getSourceHealth(sourceId: SourceId): SourceHealth {
  const current = sourceHealth.get(sourceId);
  const def = SOURCE_REGISTRY[sourceId];
  const lastSuccessTs = current?.lastSuccessAt ? Date.parse(current.lastSuccessAt) : 0;
  const stale = !lastSuccessTs || (Date.now() - lastSuccessTs > def.staleAfterMs);

  return {
    sourceId,
    status: stale && current?.status === 'ok' ? 'degraded' : (current?.status || 'degraded'),
    latencyMs: current?.latencyMs ?? null,
    lastSuccessAt: current?.lastSuccessAt ?? null,
    lastErrorAt: current?.lastErrorAt ?? null,
    stale,
  };
}

export function getAllSourceHealth(): SourceHealth[] {
  return (Object.keys(SOURCE_REGISTRY) as SourceId[]).map(getSourceHealth);
}

export function getAggregateSourceHealth(sourceIds: SourceId[]): 'ok' | 'degraded' {
  const states = sourceIds.map(getSourceHealth);
  if (states.some((s) => s.status !== 'ok' || s.stale)) return 'degraded';
  return 'ok';
}

export function makeProvenance(
  sourceId: SourceId,
  freshness: FreshnessMode,
  fetchedAt: string = new Date().toISOString()
): ProvenanceRef {
  const source = SOURCE_REGISTRY[sourceId];
  return {
    sourceId,
    sourceName: source.name,
    sourceUrl: source.homepageUrl,
    fetchedAt,
    freshness,
  };
}

export function makeProvenanceList(
  sourceIds: SourceId[],
  freshness: FreshnessMode,
  fetchedAt: string = new Date().toISOString()
): ProvenanceRef[] {
  return sourceIds.map((sourceId) => makeProvenance(sourceId, freshness, fetchedAt));
}

export async function withSourceProbe<T>(sourceId: SourceId, op: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await op();
    markSourceSuccess(sourceId, Date.now() - startedAt);
    return result;
  } catch (error) {
    markSourceFailure(sourceId);
    throw error;
  }
}
