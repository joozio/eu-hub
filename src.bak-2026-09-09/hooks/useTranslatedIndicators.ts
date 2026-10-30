'use client';

import { useState, useEffect } from 'react';
import { getIndicatorLabels, getIndicatorHints } from '@/services/eurostat';

interface TranslatedIndicators {
  labels: Record<string, string>;
  hints: Record<string, string>;
  loading: boolean;
}

export function useTranslatedIndicators(lang: string): TranslatedIndicators {
  const defaultLabels = getIndicatorLabels();
  const defaultHints = getIndicatorHints();
  const [labels, setLabels] = useState(defaultLabels);
  const [hints, setHints] = useState(defaultHints);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lang || lang === 'en') {
      setLabels(defaultLabels);
      setHints(defaultHints);
      return;
    }

    const cacheKey = `indicator-labels-${lang}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setLabels(parsed.labels || defaultLabels);
        setHints(parsed.hints || defaultHints);
        return;
      } catch { /* fetch fresh */ }
    }

    setLoading(true);
    fetch('/api/translate-indicators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, labels: defaultLabels, hints: defaultHints }),
    })
      .then((r) => r.json())
      .then((data) => {
        setLabels(data.labels || defaultLabels);
        setHints(data.hints || defaultHints);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      })
      .catch(() => {
        setLabels(defaultLabels);
        setHints(defaultHints);
      })
      .finally(() => setLoading(false));
  }, [lang]);

  return { labels, hints, loading };
}
