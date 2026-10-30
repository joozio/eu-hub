'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SkeletonStat } from '@/components/ui/skeleton';
import { useTranslation, countryName, countryFlag } from '@/hooks/useProfile';
import { useTranslatedIndicators } from '@/hooks/useTranslatedIndicators';
import { useSparklines } from '@/hooks/useSparklines';
import { Sparkline } from '@/components/ui/sparkline';
import { ShareButton } from '@/components/ui/share-button';
import { EU_COUNTRIES } from '@/lib/countries';
import { getCurrency, isEurozone, eurToLocal } from '@/lib/currencies';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Category = 'economy' | 'living' | 'society';

interface StatData {
  indicator: string;
  country: string;
  period: string;
  periodLabel: string;
  value: number;
  unit: string;
  label: string;
  source: string;
  category: Category;
}

const CATEGORY_COLORS: Record<Category, string> = {
  economy: '#003399',
  living: '#6366f1',
  society: '#10b981',
};

export default function StatsPage() {
  const router = useRouter();
  const { t, lang, profile } = useTranslation();
  const { labels: translatedLabels, hints: translatedHints, loading: labelsLoading } = useTranslatedIndicators(lang);

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const country = countryOverride ?? profile.country;
  const [activeTab, setActiveTab] = useState<Category>('economy');
  const [countryData, setCountryData] = useState<StatData[]>([]);
  const [euData, setEuData] = useState<StatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  const CATEGORY_META: Record<Category, { label: string; icon: string; indicatorIds: string[] }> = {
    economy: {
      label: t('stats.economy'),
      icon: '\ud83d\udcca',
      indicatorIds: ['inflation', 'food_inflation', 'unemployment', 'gdp_growth', 'minimum_wages', 'gov_debt'],
    },
    living: {
      label: t('stats.living'),
      icon: '\ud83c\udfe0',
      indicatorIds: ['youth_unemployment', 'median_income', 'housing_prices', 'housing_cost_burden', 'poverty_risk', 'material_deprivation'],
    },
    society: {
      label: t('stats.society'),
      icon: '\ud83c\udf0d',
      indicatorIds: ['life_expectancy', 'tertiary_education', 'gini', 'gender_pay_gap', 'renewable_energy', 'greenhouse_gas', 'internet_access'],
    },
  };

  // Sparklines: fetch time series for current category's indicators
  const sparklineIds = CATEGORY_META[activeTab]?.indicatorIds ?? [];
  const { series: sparklineSeries } = useSparklines(country, sparklineIds);

  const loadData = useCallback(async () => {
    if (!country) return;
    setLoading(true);
    setInsight('');
    try {
      const { fetchEurostatWithComparison } = await import('@/services/api');
      const allIds = Object.values(CATEGORY_META).flatMap(c => c.indicatorIds);
      const result = await fetchEurostatWithComparison(country, allIds);
      if (result.success) {
        setCountryData(result.country as StatData[]);
        setEuData(result.eu as StatData[]);
      }
    } catch (error) {
      console.error('Failed to fetch Eurostat data:', error);
      const fallbackData: StatData[] = Object.entries(CATEGORY_META).flatMap(([categoryKey, cat]) =>
        cat.indicatorIds.map((indicator: string) => ({
          indicator, country, period: '2024', periodLabel: '2024',
          value: 0, unit: '%', label: indicator.replace('_', ' '),
          source: 'Fallback', category: categoryKey as Category,
        }))
      );
      setCountryData(fallbackData);
      setEuData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { loadData(); }, [loadData]);

  const catColor = CATEGORY_COLORS[activeTab];
  const catMeta = CATEGORY_META[activeTab];
  const catCountry = countryData.filter(d => catMeta.indicatorIds.includes(d.indicator));
  const catEU = euData.filter(d => catMeta.indicatorIds.includes(d.indicator));
  const cn = countryName(country);

  const chartableUnits = ['%'];
  const chartIndicators = catCountry.filter(d => chartableUnits.includes(d.unit));
  const labels = chartIndicators.map(d => (translatedLabels[d.indicator] || d.label).replace(' (est.)', ''));
  const chartData = {
    labels,
    datasets: [
      {
        label: cn,
        data: chartIndicators.map(d => d.value),
        backgroundColor: catColor,
        borderColor: catColor,
        borderWidth: 0,
        borderRadius: 8,
      },
      {
        label: t('stats.vs'),
        data: chartIndicators.map(d => {
          const match = catEU.find(e => e.indicator === d.indicator);
          return match?.value ?? 0;
        }),
        backgroundColor: '#e2e8f0',
        borderColor: '#e2e8f0',
        borderWidth: 0,
        borderRadius: 8,
      },
    ],
  };
  const hasChart = chartIndicators.length > 0;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: '#0c1629',
        titleFont: { size: 12, weight: 600 as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9', drawBorder: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: 500 as const } },
        border: { display: false },
      },
    },
  };

  const handleInsight = async () => {
    setInsightLoading(true);
    setInsight('');
    const statsContext = catCountry.map(d => {
      const euMatch = catEU.find(e => e.indicator === d.indicator);
      return `${d.label}: ${d.value}${d.unit} (EU avg: ${euMatch?.value ?? 'N/A'}${euMatch?.unit ?? ''})`;
    }).join('\n');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Based on these ${catMeta.label} statistics for ${cn}, give me a brief personalized analysis. What do these numbers mean for someone my age? How does ${cn} compare to the EU average? Keep it to 2-3 short paragraphs.\n\nData:\n${statsContext}`,
          country, age: profile.age, employmentStatus: profile.employmentStatus,
          industry: profile.industry, isParent: profile.isParent,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setInsight(data.answer);
      }
    } catch (error) {
      console.error('Failed to get AI insight:', error);
      setInsight(t('stats.insight_error'));
    } finally {
      setInsightLoading(false);
    }
  };

  // Pick one highlight stat per category for the hero card
  const highlights = [
    countryData.find(d => d.indicator === 'unemployment'),
    countryData.find(d => d.indicator === 'median_income') || countryData.find(d => d.indicator === 'youth_unemployment'),
    countryData.find(d => d.indicator === 'life_expectancy') || countryData.find(d => d.indicator === 'renewable_energy'),
  ].filter(Boolean) as StatData[];

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('stats.title')}</h1>
              <p className="text-white/70 text-sm mt-1">{t('stats.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <ShareButton title={`EU Statistics – ${countryName(country)}`} text={`Check real Eurostat data for ${countryName(country)} on EU Hub`} size="sm" />
              <select
              value={country}
              onChange={(e) => setCountryOverride(e.target.value)}
              className="px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white font-medium focus:ring-2 focus:ring-eu-gold focus:border-eu-gold outline-none transition-all text-sm"
            >
              {EU_COUNTRIES.map(c => (
                <option key={c.code} value={c.code} className="text-gray-900">{c.name}</option>
              ))}
            </select>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Country at a glance hero */}
        {!loading && highlights.length > 0 && (
          <div className="mb-6 animate-slide-up">
            <div className="rounded-2xl bg-gradient-to-r from-eu-blue to-eu-blue-vivid p-[1px]">
              <div className="rounded-2xl bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{countryFlag(country)}</span>
                  <div>
                    <h2 className="font-bold text-gray-900">{cn}</h2>
                    <p className="text-xs text-gray-600">{t('stats.key_highlights')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {highlights.map(stat => {
                    const euMatch = euData.find(e => e.indicator === stat.indicator);
                    const diff = euMatch ? stat.value - euMatch.value : null;
                    return (
                      <div key={stat.indicator} className="text-center">
                        <p className="text-xs text-gray-600 mb-1">{translatedLabels[stat.indicator] || stat.label}</p>
                        <p className="text-xl sm:text-2xl font-bold font-data" style={{ color: CATEGORY_COLORS[stat.category] }}>
                          {stat.unit.startsWith('EUR') && !isEurozone(country) ? (
                            <AnimatedNumber value={eurToLocal(stat.value, country)} suffix={` ${getCurrency(country).code}`} decimals={0} />
                          ) : (
                            <AnimatedNumber value={stat.value} suffix={stat.unit === 'EUR/month' ? '' : stat.unit} prefix={stat.unit === 'EUR/month' ? '\u20ac' : ''} decimals={stat.unit === 'EUR/month' ? 0 : 1} />
                          )}
                        </p>
                        {diff !== null && (
                          <span className={`text-xs font-medium ${isPositiveDirection(stat.indicator, diff) ? 'text-emerald-600' : diff === 0 ? 'text-gray-400' : 'text-red-500'}`}>
                            {diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '\u2192'} {t('stats.vs')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Category); setInsight(''); }}>
          <TabsList className="mb-6">
            {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META.economy][]).map(([key, meta]) => (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <span>{meta.icon}</span>
                {meta.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {(['economy', 'living', 'society'] as Category[]).map(cat => (
            <TabsContent key={cat} value={cat}>
              {(loading || labelsLoading) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2, 3].map(i => <SkeletonStat key={i} />)}
                </div>
              ) : (
                <>
                  {/* Chart */}
                  {hasChart && (
                    <div className="rounded-xl border border-gray-100 bg-white p-5 mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">{countryFlag(country)}</span>
                        <h3 className="font-semibold text-gray-900">{cn} {t('stats.vs')}</h3>
                      </div>
                      <div className="h-72">
                        <Bar data={chartData} options={chartOptions} />
                      </div>
                    </div>
                  )}

                  {/* Stat cards - bento grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {catCountry.map((item, idx) => {
                      const euMatch = catEU.find(e => e.indicator === item.indicator);
                      const diff = euMatch ? item.value - euMatch.value : null;
                      const isFeatured = idx === 0;

                      return (
                        <div
                          key={item.indicator}
                          className={`rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all animate-slide-up p-5 ${isFeatured ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                          style={{ animationDelay: `${idx * 80}ms` }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="text-sm font-medium text-gray-700">{translatedLabels[item.indicator] || item.label}</p>
                              {translatedHints[item.indicator] && (
                                <p className="text-xs text-gray-400 mt-0.5">{translatedHints[item.indicator]}</p>
                              )}
                            </div>
                            {diff !== null && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isPositiveDirection(item.indicator, diff)
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : diff === 0 ? 'bg-gray-50 text-gray-500'
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)} {t('stats.vs')}
                              </span>
                            )}
                          </div>

                          {/* Sparkline trend */}
                          {sparklineSeries[item.indicator] && sparklineSeries[item.indicator].length >= 2 && (
                            <div className="mt-1.5 mb-1">
                              <Sparkline
                                data={sparklineSeries[item.indicator]}
                                higherIsBetter={!isPositiveDirection(item.indicator, -1)}
                                width={80}
                                height={24}
                              />
                            </div>
                          )}

                          <p className="text-3xl font-bold font-data mt-2" style={{ color: catColor }}>
                            {item.unit.startsWith('EUR') && !isEurozone(country) ? (
                              <>
                                <AnimatedNumber
                                  value={eurToLocal(item.value, country)}
                                  suffix={` ${getCurrency(country).code}`}
                                  decimals={0}
                                />
                              </>
                            ) : (
                              <AnimatedNumber
                                value={item.value}
                                prefix={item.unit.startsWith('EUR') ? '\u20ac' : ''}
                                suffix={item.unit.startsWith('EUR') ? '' : item.unit === 'years' ? ' yr' : item.unit === 'tonnes' ? 't' : item.unit}
                                decimals={item.unit.startsWith('EUR') ? 0 : 1}
                              />
                            )}
                          </p>
                          {item.unit.startsWith('EUR') && !isEurozone(country) && (
                            <p className="text-xs text-gray-500 mt-0.5">{'≈ €'}{Math.round(item.value).toLocaleString()}{item.unit === 'EUR/month' ? '/mo' : ''}</p>
                          )}

                          {euMatch && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                <span>{cn}</span>
                                <span>{t('stats.eu_avg')} {formatValue(euMatch.value, euMatch.unit)}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${barWidth(item.value, euMatch.value)}%`,
                                    backgroundColor: catColor,
                                  }}
                                />
                                <div
                                  className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-gray-400 rounded-full"
                                  style={{ left: `${barWidth(euMatch.value, Math.max(item.value, euMatch.value))}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-gray-500 mt-2.5">
                            {item.periodLabel} &middot; {item.source}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Insight */}
                  <div className="rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-100/50 p-5">
                    {!insight && !insightLoading && (
                      <button
                        onClick={handleInsight}
                        className="w-full flex items-center justify-center gap-2 py-3 text-eu-blue font-semibold hover:text-eu-blue-vivid transition-colors group"
                      >
                        <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {t('stats.insight')}
                      </button>
                    )}
                    {insightLoading && (
                      <div className="flex items-center justify-center gap-3 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 bg-eu-blue rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">{t('stats.analyzing')}</span>
                      </div>
                    )}
                    {insight && (
                      <div className="animate-slide-up">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-6 h-6 bg-gradient-to-br from-eu-blue to-eu-blue-vivid rounded-lg flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
                            </svg>
                          </span>
                          <span className="text-sm font-semibold text-gray-800">{t('stats.label')}</span>
                          <span className="text-xs text-gray-500 ml-auto">Mistral AI</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight}</p>
                        <button onClick={handleInsight} className="mt-3 text-xs text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors">
                          {t('stats.regen')}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

function formatValue(value: number, unit: string, countryCode?: string): string {
  if (unit === 'EUR/month') {
    if (countryCode && !isEurozone(countryCode)) {
      const c = getCurrency(countryCode);
      return `${eurToLocal(value, countryCode).toLocaleString()} ${c.code}/mo`;
    }
    return `\u20ac${Math.round(value)}/mo`;
  }
  if (unit === 'EUR/year') {
    if (countryCode && !isEurozone(countryCode)) {
      const c = getCurrency(countryCode);
      return `${eurToLocal(value, countryCode).toLocaleString()} ${c.code}`;
    }
    return `\u20ac${Math.round(value).toLocaleString()}`;
  }
  if (unit === 'index') return value.toFixed(1);
  if (unit === 'years') return `${value.toFixed(1)} yr`;
  if (unit === 'tonnes') return `${value.toFixed(1)}t`;
  if (unit === '') return value.toFixed(1);
  return `${value.toFixed(1)}${unit}`;
}

function barWidth(value: number, euValue: number): number {
  const max = Math.max(value, euValue, 1);
  return Math.min(Math.round((value / max) * 100), 100);
}

function isPositiveDirection(indicator: string, diff: number): boolean {
  const lowerIsBetter = [
    'unemployment', 'youth_unemployment', 'inflation', 'food_inflation',
    'poverty_risk', 'gini', 'gov_debt', 'housing_cost_burden',
    'material_deprivation', 'gender_pay_gap', 'greenhouse_gas',
  ];
  if (lowerIsBetter.includes(indicator)) return diff < 0;
  return diff > 0;
}
