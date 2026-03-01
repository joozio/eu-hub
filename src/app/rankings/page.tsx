'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation, countryFlag } from '@/hooks/useProfile';
import { useTranslatedIndicators } from '@/hooks/useTranslatedIndicators';
import { ShareButton } from '@/components/ui/share-button';
import type { IndicatorRanking, RankingsData } from '@/services/eurostat-rankings';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Category = 'all' | 'economy' | 'living' | 'society';

interface RankingsMeta {
  fetchedAt: string;
  methodologyVersion: 'v2';
  coveragePct: number;
  freshness: 'live' | 'cached' | 'stale' | 'snapshot';
  sourceHealth: 'ok' | 'degraded';
}

export default function RankingsPage() {
  const router = useRouter();
  const { t, lang, profile } = useTranslation();
  const { labels: translatedLabels } = useTranslatedIndicators(lang);
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>('all');
  const [meta, setMeta] = useState<RankingsMeta | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  useEffect(() => {
    fetch('/api/rankings')
      .then(r => r.json())
      .then((d: RankingsData & { meta?: RankingsMeta }) => {
        if (d.indicators) setData(d);
        if (d.meta) setMeta(d.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const userCountry = profile.country;

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'all') return data.indicators;
    return data.indicators.filter(i => i.category === activeTab);
  }, [data, activeTab]);

  // Scorecard: user's rank in each indicator
  const scorecard = useMemo(() => {
    if (!data || !userCountry) return [];
    return data.indicators.map(ind => {
      const entry = ind.entries.find(e => e.country === userCountry);
      return {
        indicatorId: ind.indicatorId,
        label: translatedLabels[ind.indicatorId] || ind.label,
        rank: entry?.rank ?? null,
        total: ind.countriesWithData,
        category: ind.category,
      };
    });
  }, [data, userCountry, translatedLabels]);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Hero */}
      <div className="hero-mesh hero-tone-rankings">
        <div className="hero-content max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                {t('rankings.title')}
              </h1>
              <p className="text-white/70 text-sm mt-1">{t('rankings.subtitle')}</p>
              {meta && (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                  <span className={`px-2 py-0.5 rounded-full border ${
                    meta.sourceHealth === 'ok' ? 'bg-emerald-500/20 border-emerald-300/40' : 'bg-amber-500/20 border-amber-300/40'
                  }`}>
                    {meta.sourceHealth === 'ok' ? 'Eurostat healthy' : 'Eurostat degraded'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-white/20 bg-white/10 uppercase">{meta.freshness}</span>
                  <span className="text-white/60">Coverage {meta.coveragePct}%</span>
                </div>
              )}
            </div>
            <ShareButton title="EU Country Rankings" text="Compare all 27 EU countries on EU Hub" size="sm" className="shrink-0 mt-1" />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <LoadingSkeleton />
        ) : !data ? (
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
            <p className="text-gray-500 dark:text-slate-300">{t('common.error')}</p>
          </div>
        ) : (
          <>
            {/* Scorecard */}
            {userCountry && scorecard.length > 0 && (
              <div className="animate-slide-up">
                <div className="rounded-2xl bg-gradient-to-r from-eu-blue to-eu-blue-vivid p-[1px]">
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{countryFlag(userCountry)}</span>
                      <div>
                        <h2 className="font-bold text-gray-900 dark:text-slate-100">{t('rankings.scorecard')}</h2>
                        <p className="text-xs text-gray-500 dark:text-slate-300">{t('rankings.your_rank')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {scorecard.map(s => {
                        const tier = s.rank === null ? 'na'
                          : s.rank <= 9 ? 'top'
                          : s.rank > s.total - 9 ? 'bottom'
                          : 'mid';
                        return (
                          <div
                            key={s.indicatorId}
                            className={`card-spotlight rounded-xl p-3 text-center border ${
                              tier === 'top' ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
                              : tier === 'bottom' ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                              : tier === 'na' ? 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/70'
                              : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/70'
                            }`}
                          >
                            <p className="text-xs text-gray-600 dark:text-slate-300 truncate mb-1">{s.label}</p>
                            {s.rank !== null ? (
                              <>
                                <p className={`text-xl font-bold font-data ${
                                  tier === 'top' ? 'text-amber-600 dark:text-amber-300'
                                  : tier === 'bottom' ? 'text-red-600 dark:text-red-300'
                                  : 'text-gray-700 dark:text-slate-200'
                                }`}>
                                  #{s.rank}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-300">{t('rankings.of_countries').replace('{n}', String(s.total))}</p>
                              </>
                            ) : (
                              <p className="text-lg font-bold text-gray-400 dark:text-slate-500">N/A</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Tabs */}
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Category)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">{t('rankings.all')}</TabsTrigger>
                <TabsTrigger value="economy">{t('stats.economy')}</TabsTrigger>
                <TabsTrigger value="living">{t('stats.living')}</TabsTrigger>
                <TabsTrigger value="society">{t('stats.society')}</TabsTrigger>
              </TabsList>

              {(['all', 'economy', 'living', 'society'] as Category[]).map(cat => (
                <TabsContent key={cat} value={cat}>
                  <div className="space-y-6">
                    {filtered.map((indicator, idx) => (
                      <RankingChart
                        key={indicator.indicatorId}
                        indicator={indicator}
                        userCountry={userCountry}
                        t={t}
                        translatedLabel={translatedLabels[indicator.indicatorId] || indicator.label}
                        freshness={meta?.freshness}
                        fetchedAt={meta?.fetchedAt}
                        isDark={isDark}
                        delay={idx * 80}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

function RankingChart({
  indicator,
  userCountry,
  t,
  translatedLabel,
  freshness,
  fetchedAt,
  isDark,
  delay,
}: {
  indicator: IndicatorRanking;
  userCountry: string;
  t: (key: string) => string;
  translatedLabel: string;
  freshness?: string;
  fetchedAt?: string;
  isDark: boolean;
  delay: number;
}) {
  const userEntry = indicator.entries.find(e => e.country === userCountry);
  const entriesWithData = indicator.entries.filter(e => e.value !== null);

  // Use plain text labels (flag emojis render inconsistently in canvas)
  const labels = entriesWithData.map(e => e.country);
  const values = entriesWithData.map(e => e.value as number);

  const bgColors = entriesWithData.map(e =>
    e.country === userCountry
      ? '#FFCC00'
      : isDark ? 'rgba(147, 197, 253, 0.55)' : 'rgba(0, 51, 153, 0.4)'
  );
  const borderColors = entriesWithData.map(e =>
    e.country === userCountry
      ? '#D4A800'
      : isDark ? 'rgba(191, 219, 254, 0.95)' : 'rgba(0, 51, 153, 0.6)'
  );

  const chartData = {
    labels,
    datasets: [{
      label: translatedLabel,
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1,
      borderRadius: 4,
      barThickness: 20,
    }],
  };

  const chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 20 }, // Space for EU avg label above chart
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#020617' : '#0c1629',
        titleFont: { size: 12, weight: 600 as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (items: any[]) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            const entry = entriesWithData[idx];
            return `${countryFlag(entry.country)} ${entry.countryName}`;
          },
          label: (ctx: { raw: unknown }) => {
            const val = ctx.raw as number;
            return ` ${val}${indicator.unit ? ' ' + indicator.unit : ''}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: !values.some(v => v < 0),
        grid: { color: isDark ? 'rgba(148, 163, 184, 0.14)' : '#f1f5f9', drawBorder: false },
        ticks: { color: isDark ? '#94a3b8' : '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#cbd5e1' : '#64748b',
          font: { size: 12, family: 'monospace' },
          autoSkip: false,
        },
        border: { display: false },
      },
    },
  };

  // EU average dashed line plugin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const euAveragePlugin: any = indicator.euAverage !== null ? {
    id: `eu-avg-${indicator.indicatorId}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDraw: (chart: any) => {
      const { ctx, chartArea, scales } = chart;
      const xPos = scales.x.getPixelForValue(indicator.euAverage as number);
      if (xPos < chartArea.left || xPos > chartArea.right || isNaN(xPos)) return;

      ctx.save();
      // Dashed line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = isDark ? '#fb7185' : '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xPos, chartArea.top);
      ctx.lineTo(xPos, chartArea.bottom);
      ctx.stroke();

      // Label above chart area (inside the top padding)
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? '#fb7185' : '#ef4444';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(t('rankings.eu_avg'), xPos, chartArea.top - 6);
      ctx.restore();
    },
  } : null;

  const chartHeight = Math.max(entriesWithData.length * 28 + 60, 200);

  return (
    <div
      className="card-spotlight rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/70 p-5 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{translatedLabel}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-300">
            {indicator.unit && <span>{indicator.unit}</span>}
            {indicator.euAverage !== null && (
              <span className="ml-2 text-red-500">{t('rankings.eu_avg')}: {indicator.euAverage}{indicator.unit ? ' ' + indicator.unit : ''}</span>
            )}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-slate-300 mt-1">
            Source: Eurostat &middot; {fetchedAt ? new Date(fetchedAt).toLocaleString() : 'latest'}
            {freshness && <span className="ml-1 uppercase">({freshness})</span>}
          </p>
        </div>
        {userEntry?.rank && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            userEntry.rank <= 9 ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-200'
            : userEntry.rank > indicator.countriesWithData - 9 ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-200'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
          }`}>
            #{userEntry.rank} {t('rankings.of_countries').replace('{n}', String(indicator.countriesWithData))}
          </span>
        )}
      </div>
      <div style={{ height: chartHeight }}>
        <Bar
          data={chartData}
          options={chartOptions}
          plugins={euAveragePlugin ? [euAveragePlugin] : []}
        />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Scorecard skeleton */}
      <div className="rounded-2xl bg-gradient-to-r from-eu-blue/20 to-eu-blue-vivid/20 p-[1px]">
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 p-5">
          <div className="h-6 bg-gray-100 dark:bg-slate-700 rounded w-40 mb-4 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 dark:border-slate-700 p-3 animate-pulse">
                <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-full mb-2" />
                <div className="h-6 bg-gray-100 dark:bg-slate-700 rounded w-12 mx-auto mb-1" />
                <div className="h-3 bg-gray-50 dark:bg-slate-800 rounded w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Chart skeletons */}
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/70 p-5 animate-pulse">
          <div className="h-5 bg-gray-100 dark:bg-slate-700 rounded w-48 mb-2" />
          <div className="h-3 bg-gray-50 dark:bg-slate-800 rounded w-32 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <div className="h-4 bg-gray-50 dark:bg-slate-800 rounded w-12" />
                <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded flex-1" style={{ maxWidth: `${80 - j * 8}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
