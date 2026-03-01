'use client';

import { useState, useEffect } from 'react';
import { INDICATORS, COUNTRY_MAP } from '@/services/eurostat';

export interface SparklinePoint {
  period: string;
  value: number;
}

function getEurostatGeoLocal(isoCode: string): string {
  return COUNTRY_MAP[isoCode] || isoCode;
}

function parseTimeSeries(data: Record<string, unknown>, limit = 6): SparklinePoint[] {
  const timeIndex = (data.dimension as Record<string, unknown>)?.time as Record<string, unknown>;
  const category = timeIndex?.category as Record<string, unknown>;
  const index = category?.index as Record<string, number>;
  const values = data.value as Record<string, number>;

  if (!index || !values) return [];

  return Object.entries(index)
    .sort(([, a], [, b]) => a - b) // chronological
    .map(([period, idx]) => {
      const val = values[String(idx)];
      return val != null ? { period, value: Math.round(val * 100) / 100 } : null;
    })
    .filter((x): x is SparklinePoint => x !== null)
    .slice(-limit);
}

// Cache to avoid refetching (module-level, per session)
const sparklineCache = new Map<string, SparklinePoint[]>();

export function useSparklines(country: string, indicatorIds: string[]) {
  const [series, setSeries] = useState<Record<string, SparklinePoint[]>>({});
  const [loading, setLoading] = useState(false);

  const key = `${country}:${indicatorIds.join(',')}`;

  useEffect(() => {
    if (!country || indicatorIds.length === 0) return;
    let cancelled = false;

    setLoading(true);
    const geo = getEurostatGeoLocal(country);

    Promise.allSettled(
      indicatorIds.map(async (id) => {
        const cacheKey = `${country}:${id}`;
        if (sparklineCache.has(cacheKey)) {
          return { id, pts: sparklineCache.get(cacheKey)! };
        }
        const config = INDICATORS.find(i => i.id === id);
        if (!config) return null;
        const url = config.buildUrl(geo);
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          const pts = parseTimeSeries(data);
          sparklineCache.set(cacheKey, pts);
          return { id, pts };
        } catch {
          return null;
        }
      })
    ).then(results => {
      if (cancelled) return;
      const newSeries: Record<string, SparklinePoint[]> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          newSeries[r.value.id] = r.value.pts;
        }
      });
      setSeries(newSeries);
      setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { series, loading };
}
