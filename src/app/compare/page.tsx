'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation, countryFlag, countryName } from '@/hooks/useProfile';
import CountrySelector from '@/components/CountrySelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonStat } from '@/components/ui/skeleton';
import { ShareButton } from '@/components/ui/share-button';
import { getCurrency, isEurozone, eurToLocal } from '@/lib/currencies';
import { getClientDemoMode, shouldFallbackToSnapshot, shouldUseSnapshot } from '@/lib/demo-mode';
import compareSnapshot from '@/data/demo/compare.json';
import { useTranslatedIndicators } from '@/hooks/useTranslatedIndicators';

interface IndicatorConfig {
  id: string;
  label: string;
  unit: string;
  category: 'economy' | 'living' | 'society';
  higherIsBetter: boolean;
  fallback: number;
}

const COMPARE_INDICATORS: IndicatorConfig[] = [
  { id: 'unemployment', label: 'Unemployment Rate', unit: '%', category: 'economy', higherIsBetter: false, fallback: 6.1 },
  { id: 'gdp_growth', label: 'GDP Growth', unit: '%', category: 'economy', higherIsBetter: true, fallback: 0.9 },
  { id: 'minimum_wages', label: 'Minimum Wage', unit: 'EUR/month', category: 'economy', higherIsBetter: true, fallback: 1050 },
  { id: 'inflation', label: 'Inflation (HICP)', unit: '%', category: 'economy', higherIsBetter: false, fallback: 2.4 },
  { id: 'gov_debt', label: 'Government Debt', unit: '%', category: 'economy', higherIsBetter: false, fallback: 83.0 },
  { id: 'median_income', label: 'Median Income', unit: 'EUR/year', category: 'living', higherIsBetter: true, fallback: 18000 },
  { id: 'poverty_risk', label: 'At Risk of Poverty', unit: '%', category: 'living', higherIsBetter: false, fallback: 21.6 },
  { id: 'housing_cost_burden', label: 'Housing Cost Overburden', unit: '%', category: 'living', higherIsBetter: false, fallback: 9.4 },
  { id: 'youth_unemployment', label: 'Youth Unemployment', unit: '%', category: 'living', higherIsBetter: false, fallback: 14.5 },
  { id: 'life_expectancy', label: 'Life Expectancy', unit: 'years', category: 'society', higherIsBetter: true, fallback: 80.1 },
  { id: 'renewable_energy', label: 'Renewable Energy', unit: '%', category: 'society', higherIsBetter: true, fallback: 23.0 },
  { id: 'gender_pay_gap', label: 'Gender Pay Gap', unit: '%', category: 'society', higherIsBetter: false, fallback: 12.7 },
  { id: 'gini', label: 'Gini (Inequality)', unit: '', category: 'society', higherIsBetter: false, fallback: 30.0 },
  { id: 'tertiary_education', label: 'Tertiary Education', unit: '%', category: 'society', higherIsBetter: true, fallback: 42.0 },
];

type Category = 'all' | 'economy' | 'living' | 'society';

interface CountryData {
  [indicatorId: string]: { value: number; period: string };
}

function fallbackCountryData(country: string): CountryData {
  const snapshot = (compareSnapshot as Record<string, CountryData>)[country];
  if (snapshot) return snapshot;
  return Object.fromEntries(
    COMPARE_INDICATORS.map((indicator) => [
      indicator.id,
      { value: indicator.fallback, period: '—' },
    ])
  );
}

async function fetchCountryData(country: string): Promise<CountryData> {
  const demoMode = getClientDemoMode();

  if (shouldUseSnapshot(demoMode)) {
    return fallbackCountryData(country);
  }

  try {
    const { fetchEurostatData } = await import('@/services/api');
    const result = await fetchEurostatData(country, COMPARE_INDICATORS.map((ind) => ind.id));
    if (!result.success) throw new Error('Eurostat compare fetch failed');

    // Failed indicators come back as the same built-in estimate for every country,
    // which would show as fake ties. Drop them; rows without data are hidden.
    const rows = result.data.filter((row) => row.source !== 'Estimate');
    if (rows.length === 0) throw new Error('Eurostat compare fetch failed');

    return Object.fromEntries(
      rows.map((row) => [
        row.indicator,
        { value: row.value, period: row.period || '—' },
      ])
    );
  } catch (error) {
    if (shouldFallbackToSnapshot(demoMode)) {
      return fallbackCountryData(country);
    }
    throw error;
  }
}

function formatVal(value: number, unit: string, country: string): string {
  if (unit === 'EUR/month') {
    if (!isEurozone(country)) {
      const c = getCurrency(country);
      return `${eurToLocal(value, country).toLocaleString()} ${c.code}/mo`;
    }
    return `€${Math.round(value).toLocaleString()}/mo`;
  }
  if (unit === 'EUR/year') {
    if (!isEurozone(country)) {
      const c = getCurrency(country);
      return `${eurToLocal(value, country).toLocaleString()} ${c.code}`;
    }
    return `€${Math.round(value).toLocaleString()}`;
  }
  if (unit === 'years') return `${value.toFixed(1)} yr`;
  if (unit === '') return value.toFixed(1);
  return `${value.toFixed(1)}${unit}`;
}

export default function ComparePage() {
  const { t, lang, profile } = useTranslation();
  const { labels: translatedLabels } = useTranslatedIndicators(lang);

  const [c1, setC1] = useState(profile.country || 'DE');
  const [c2, setC2] = useState('FR');
  const [data1, setData1] = useState<CountryData>({});
  const [data2, setData2] = useState<CountryData>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('all');
  const [freshness, setFreshness] = useState<'live' | 'snapshot'>('live');
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!c1 || !c2 || c1 === c2) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let cancelled = false;
    queueMicrotask(async () => {
      if (cancelled) return;
      setLoading(true);
      setData1({});
      setData2({});
      const mode = getClientDemoMode();
      setFreshness(mode === 'snapshot' ? 'snapshot' : 'live');
      setUpdatedAt(new Date().toISOString());
      try {
        const [d1, d2] = await Promise.all([fetchCountryData(c1), fetchCountryData(c2)]);
        if (cancelled) return;
        setData1(d1);
        setData2(d2);
      } catch (error) {
        console.error('Compare data fetch failed:', error);
        if (cancelled) return;
        setFreshness('snapshot');
        setData1(fallbackCountryData(c1));
        setData2(fallbackCountryData(c2));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [c1, c2]);

  const visibleIndicators = COMPARE_INDICATORS.filter(
    ind => activeTab === 'all' || ind.category === activeTab
  );

  const indicatorLabels = useMemo(() => (
    Object.fromEntries(
      COMPARE_INDICATORS.map((indicator) => [
        indicator.id,
        translatedLabels[indicator.id] || indicator.label,
      ])
    )
  ), [translatedLabels]);

  // Score: count wins per country
  const scores = { c1: 0, c2: 0, ties: 0 };
  COMPARE_INDICATORS.forEach(ind => {
    const v1 = data1[ind.id]?.value;
    const v2 = data2[ind.id]?.value;
    if (v1 == null || v2 == null) return;
    const diff = v1 - v2;
    const eps = 0.05;
    if (Math.abs(diff) < eps) { scores.ties++; return; }
    const c1Better = ind.higherIsBetter ? diff > 0 : diff < 0;
    if (c1Better) scores.c1++; else scores.c2++;
  });
  const total = scores.c1 + scores.c2 + scores.ties;

  const n1 = countryName(c1);
  const n2 = countryName(c2);

  const CATEGORY_COLORS = isDark
    ? { economy: '#60a5fa', living: '#a78bfa', society: '#34d399' }
    : { economy: '#003399', living: '#6366f1', society: '#10b981' };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Hero */}
      <div className="hero-mesh hero-tone-compare overflow-visible">
        <div className="hero-content max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                {t('compare.title')}
              </h1>
              <p className="text-white/70 text-sm mt-1">{t('compare.subtitle')}</p>
              <p className="text-xs text-white/60 mt-1">
                {t('compare.source')}: Eurostat &middot; {freshness} &middot; {new Date(updatedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <ShareButton title={`EU Hub: ${n1} vs ${n2}`} text={`Comparing ${n1} and ${n2} across 14 EU indicators`} size="sm" className="shrink-0 mt-1" />
          </div>

          {/* Country pickers */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">{t('compare.country_a')}</p>
              <CountrySelector
                onSelect={setC1}
                selectedCountry={c1}
                searchPlaceholder={t('common.search')}
                placeholder={t('compare.select_country')}
                noResultsText={t('country.no_results')}
              />
            </div>
            <div className="flex items-center justify-center">
              <span className="text-white/60 text-sm font-bold px-2 py-3 sm:py-0">VS</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">{t('compare.country_b')}</p>
              <CountrySelector
                onSelect={setC2}
                selectedCountry={c2}
                searchPlaceholder={t('common.search')}
                placeholder={t('compare.select_country')}
                noResultsText={t('country.no_results')}
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {c1 === c2 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
            {t('compare.select_different')}
          </div>
        )}

        {/* Head-to-head scorecard */}
        {!loading && total > 0 && c1 !== c2 && (
          <div className="mb-6 animate-slide-up">
            <div className="card-spotlight rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-300 uppercase tracking-wider mb-4">{t('compare.head_to_head')} ({total} {t('nav.stats').toLowerCase()})</p>
                <div className="flex items-center gap-3">
                  {/* Country A */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl sm:text-4xl mb-1">{countryFlag(c1)}</p>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{n1}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: scores.c1 >= scores.c2 ? CATEGORY_COLORS.economy : '#94a3b8' }}>
                      {scores.c1}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-300">{t('compare.wins')}</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-[2] flex flex-col items-center gap-1.5">
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all duration-700 ease-out"
                        style={{ width: total > 0 ? `${(scores.c1 / total) * 100}%` : '50%', background: `linear-gradient(90deg, ${CATEGORY_COLORS.economy}, #60a5fa)` }}
                      />
                      {scores.ties > 0 && (
                        <div
                          className="h-full bg-gray-300 transition-all duration-700 ease-out"
                          style={{ width: `${(scores.ties / total) * 100}%` }}
                        />
                      )}
                      <div
                        className="h-full rounded-r-full transition-all duration-700 ease-out"
                        style={{ width: total > 0 ? `${(scores.c2 / total) * 100}%` : '50%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                      />
                    </div>
                    {scores.ties > 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-400">{scores.ties} {t('compare.tied').toLowerCase()}</p>
                    )}
                    <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                      {scores.c1 > scores.c2 ? `${n1} ${t('compare.leads')}` : scores.c2 > scores.c1 ? `${n2} ${t('compare.leads')}` : t('compare.even_match')}
                    </p>
                  </div>

                  {/* Country B */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl sm:text-4xl mb-1">{countryFlag(c2)}</p>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{n2}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: scores.c2 >= scores.c1 ? CATEGORY_COLORS.living : '#94a3b8' }}>
                      {scores.c2}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-300">{t('compare.wins')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">{t('compare.all')} ({COMPARE_INDICATORS.length})</TabsTrigger>
            <TabsTrigger value="economy">{t('stats.economy')}</TabsTrigger>
            <TabsTrigger value="living">{t('stats.living')}</TabsTrigger>
            <TabsTrigger value="society">{t('stats.society')}</TabsTrigger>
          </TabsList>

          {(['all', 'economy', 'living', 'society'] as Category[]).map(cat => (
            <TabsContent key={cat} value={cat}>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => <SkeletonStat key={i} />)}
                </div>
              ) : c1 === c2 ? null : (
                <div className="space-y-3">
                  {visibleIndicators.map((ind, idx) => {
                    const v1 = data1[ind.id]?.value ?? null;
                    const v2 = data2[ind.id]?.value ?? null;

                    if (v1 == null || v2 == null) return null;

                    const diff = v1 - v2;
                    const eps = 0.05;
                    const isTied = Math.abs(diff) < eps;
                    const c1Wins = !isTied && (ind.higherIsBetter ? diff > 0 : diff < 0);
                    const c2Wins = !isTied && !c1Wins;

                    const maxVal = Math.max(Math.abs(v1), Math.abs(v2), 0.01);
                    const bar1Width = Math.min((Math.abs(v1) / maxVal) * 100, 100);
                    const bar2Width = Math.min((Math.abs(v2) / maxVal) * 100, 100);

                    const catColor = CATEGORY_COLORS[ind.category];

                    return (
                      <div
                        key={ind.id}
                        className="card-spotlight rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 animate-slide-up hover:shadow-sm transition-shadow"
                        style={{ animationDelay: `${idx * 40}ms` }}
                        role="row"
                        aria-label={`${indicatorLabels[ind.id] || ind.label}: ${n1} ${v1}${ind.unit} vs ${n2} ${v2}${ind.unit}`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{indicatorLabels[ind.id] || ind.label}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isTied ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300' : c1Wins ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-200' : 'bg-purple-50 dark:bg-violet-950/40 text-purple-700 dark:text-violet-200'
                          }`}>
                            {isTied ? t('compare.tied') : c1Wins ? `${countryFlag(c1)} ${t('compare.wins')}` : `${countryFlag(c2)} ${t('compare.wins')}`}
                          </span>
                        </div>

                        {/* Country A bar */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-base flex-shrink-0 w-6 text-center">{countryFlag(c1)}</span>
                          <div className="flex-1">
                            <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${bar1Width}%`,
                                  backgroundColor: c1Wins ? CATEGORY_COLORS.economy : isTied ? '#64748b' : '#cbd5e1',
                                }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums min-w-[80px] text-right ${c1Wins ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-200'}`}>
                            {formatVal(v1, ind.unit, c1)}
                          </span>
                        </div>

                        {/* Country B bar */}
                        <div className="flex items-center gap-3">
                          <span className="text-base flex-shrink-0 w-6 text-center">{countryFlag(c2)}</span>
                          <div className="flex-1">
                            <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${bar2Width}%`,
                                  backgroundColor: c2Wins ? CATEGORY_COLORS.living : isTied ? '#64748b' : '#cbd5e1',
                                }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums min-w-[80px] text-right ${c2Wins ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-slate-200'}`}>
                            {formatVal(v2, ind.unit, c2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-300 mt-2">
                          {t('compare.source')}: Eurostat &middot; {t('compare.updated')} {data1[ind.id]?.period || '—'} / {data2[ind.id]?.period || '—'} &middot; {freshness}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
