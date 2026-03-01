'use client';

import { useEffect, useMemo, useState } from 'react';
import { getIndicatorLabels, getIndicatorHints } from '@/services/eurostat';

interface TranslatedIndicators {
  labels: Record<string, string>;
  hints: Record<string, string>;
  loading: boolean;
}

export function useTranslatedIndicators(lang: string): TranslatedIndicators {
  const defaultLabels = useMemo(() => getIndicatorLabels(), []);
  const defaultHints = useMemo(() => getIndicatorHints(), []);
  const [translated, setTranslated] = useState<{
    lang: string;
    labels: Record<string, string>;
    hints: Record<string, string>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lang || lang === 'en') {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const cacheKey = `indicator-labels-${lang}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        queueMicrotask(() => {
          setTranslated({
            lang,
            labels: parsed.labels || defaultLabels,
            hints: parsed.hints || defaultHints,
          });
        });
        return;
      } catch { /* fetch fresh */ }
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });

    fetch('/api/translate-indicators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, labels: defaultLabels, hints: defaultHints }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTranslated({
          lang,
          labels: data.labels || defaultLabels,
          hints: data.hints || defaultHints,
        });
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      })
      .catch(() => {
        if (!cancelled) setTranslated(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lang, defaultHints, defaultLabels]);

  const labels = translated?.lang === lang ? translated.labels : defaultLabels;
  const hints = translated?.lang === lang ? translated.hints : defaultHints;

  return { labels, hints, loading };
}
