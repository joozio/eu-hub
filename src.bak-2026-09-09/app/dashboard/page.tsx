'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation, countryName, countryFlag } from '@/hooks/useProfile';
import { useTranslatedIndicators } from '@/hooks/useTranslatedIndicators';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SkeletonStat } from '@/components/ui/skeleton';
import EUComparisonSection from '@/components/EUComparisonSection';
import { FeedItem } from '@/types';
import { getCurrency, isEurozone, eurToLocal } from '@/lib/currencies';

interface StatData {
  indicator: string;
  value: number;
  unit: string;
  label: string;
  category: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, lang, profile } = useTranslation();
  const { labels: translatedLabels } = useTranslatedIndicators(lang);

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  const country = profile.country;
  const cn = countryName(country);
  const flag = countryFlag(country);

  // Welcome greeting (Mistral)
  const [greeting, setGreeting] = useState('');
  const [greetingLoading, setGreetingLoading] = useState(true);

  // Key stats
  const [stats, setStats] = useState<StatData[]>([]);
  const [euStats, setEuStats] = useState<StatData[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Top news
  const [news, setNews] = useState<FeedItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // EU comparison insight
  const [comparisonInsight, setComparisonInsight] = useState('');
  const [comparisonInsightLoading, setComparisonInsightLoading] = useState(false);

  // Profile completeness
  const isProfileIncomplete = !profile.employmentStatus || !profile.industry || !profile.housingStatus;

  useEffect(() => {
    if (!country) return;

    // Fetch welcome greeting
    fetch('/api/dashboard-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country, age: profile.age,
        employmentStatus: profile.employmentStatus, lang,
      }),
    })
      .then((r) => r.json())
      .then((data) => setGreeting(data.greeting || ''))
      .catch(() => {})
      .finally(() => setGreetingLoading(false));

    // Fetch key stats
    (async () => {
      try {
        const { fetchEurostatWithComparison } = await import('@/services/api');
        const result = await fetchEurostatWithComparison(country, ['unemployment', 'life_expectancy', 'median_income']);
        if (result.success) {
          setStats(result.country as StatData[]);
          setEuStats(result.eu as StatData[]);
        }
      } catch { /* ignore */ }
      finally { setStatsLoading(false); }
    })();

    // Fetch top news - try quick first for instant display, then warm the cache
    fetch(`/api/eu-feed?country=${country}&age=${profile.age}&quick=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setNews((data.data || []).slice(0, 3));
        // If we got raw (untranslated) data, trigger a full fetch in the background
        // to warm the cache with translated content for when user visits feed
        if (data.source === 'live-raw') {
          fetch(`/api/eu-feed?country=${country}&age=${profile.age}`).then(r => r.json()).then(fullData => {
            if (fullData.success) setNews((fullData.data || []).slice(0, 3));
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [country, profile.age, profile.employmentStatus, lang]);

  const handleComparisonInsight = async () => {
    setComparisonInsightLoading(true);
    try {
      const res = await fetch('/api/eu-comparison-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country, age: profile.age,
          employmentStatus: profile.employmentStatus, lang,
        }),
      });
      const data = await res.json();
      setComparisonInsight(data.insight || '');
    } catch { /* ignore */ }
    finally { setComparisonInsightLoading(false); }
  };

  const STAT_COLORS: Record<string, string> = {
    unemployment: '#003399',
    life_expectancy: '#10b981',
    median_income: '#6366f1',
  };

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8 pb-24 md:pb-8">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        {/* 1. Welcome Hero */}
        <div className="rounded-2xl overflow-hidden animate-slide-up relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{flag}</span>
              <div>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('dashboard.title')}</h1>
                <p className="text-xs text-white/70">{cn} &middot; {profile.age} {t('common.age').toLowerCase()}</p>
              </div>
            </div>
            {greetingLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded-full w-full animate-pulse" />
                <div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse" />
              </div>
            ) : greeting ? (
              <p className="text-sm text-white/90 leading-relaxed">{greeting}</p>
            ) : (
              <p className="text-sm text-white/60 italic">{t('landing.powered')}</p>
            )}
            <p className="text-xs text-white/50 mt-3">Mistral AI</p>
          </div>
        </div>

        {/* 2. Profile Completion CTA */}
        {isProfileIncomplete && (
          <Link
            href="/profile"
            className="block rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors animate-slide-up"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">&#9997;&#65039;</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">{t('dashboard.complete_profile')}</p>
                <p className="text-xs text-amber-700 mt-0.5">{t('profile.subtitle')}</p>
              </div>
              <svg className="w-5 h-5 text-amber-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* 3. Key Statistics */}
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">{t('dashboard.key_stats')}</h2>
            <Link href="/stats" className="text-sm text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors">
              {t('dashboard.view_all')} &rarr;
            </Link>
          </div>
          {statsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <SkeletonStat key={i} />)}
            </div>
          ) : stats.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
              <p className="text-sm text-gray-400">{t('common.error')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('common.retry')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.map((stat) => {
                const euMatch = euStats.find((e) => e.indicator === stat.indicator);
                const diff = euMatch ? stat.value - euMatch.value : null;
                const color = STAT_COLORS[stat.indicator] || '#003399';
                return (
                  <Link
                    key={stat.indicator}
                    href="/stats"
                    className="rounded-xl border border-gray-100 bg-white p-4 card-hover group"
                  >
                    <p className="text-xs text-gray-600 mb-1 group-hover:text-eu-blue transition-colors">{translatedLabels[stat.indicator] || stat.label}</p>
                    <p className="text-2xl font-bold font-data" style={{ color }}>
                      {stat.unit.startsWith('EUR') && !isEurozone(country) ? (
                        <AnimatedNumber
                          value={eurToLocal(stat.value, country)}
                          suffix={` ${getCurrency(country).code}`}
                          decimals={0}
                        />
                      ) : (
                        <AnimatedNumber
                          value={stat.value}
                          prefix={stat.unit.startsWith('EUR') ? '\u20ac' : ''}
                          suffix={stat.unit.startsWith('EUR') ? '' : stat.unit === 'years' ? ' yr' : stat.unit}
                          decimals={stat.unit.startsWith('EUR') ? 0 : 1}
                        />
                      )}
                    </p>
                    {stat.unit.startsWith('EUR') && !isEurozone(country) && (
                      <p className="text-xs text-gray-500">{'≈ €'}{Math.round(stat.value).toLocaleString()}</p>
                    )}
                    {diff !== null && euMatch && (
                      <p className="text-xs text-gray-500 mt-1">
                        {t('stats.eu_avg')} {formatValue(euMatch.value, euMatch.unit)} ({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Top EU News */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">{t('dashboard.top_news')}</h2>
            <Link href="/feed" className="text-sm text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors">
              {t('dashboard.view_all')} &rarr;
            </Link>
          </div>
          {newsLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex-shrink-0 w-72 sm:w-80 rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-16 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
              <p className="text-sm text-gray-400">{t('feed.empty')}</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-72 sm:w-80 snap-start rounded-xl border border-gray-100 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.type === 'legislation' ? 'bg-blue-50 text-blue-700' :
                      item.type === 'news' ? 'bg-gray-50 text-gray-600' :
                      item.type === 'proposal' ? 'bg-purple-50 text-purple-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      {t(`feed.type.${item.type}`)}
                    </span>
                    {item.source && <span className="text-xs text-gray-500">{item.source}</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-eu-blue transition-colors">{item.title}</h3>
                  {item.summary && (
                    <p className="text-xs text-gray-500 line-clamp-2">{item.summary}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">{item.date}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 5. Life in the EU - Comparisons (preview) */}
        <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-1">
            <div />
            <Link href="/eu-life" className="text-sm text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors">
              {t('dashboard.view_all')} &rarr;
            </Link>
          </div>
          <EUComparisonSection
            t={t}
            insight={comparisonInsight}
            insightLoading={comparisonInsightLoading}
            onRequestInsight={handleComparisonInsight}
          />
        </div>

        {/* 6. Quick Links */}
        <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h2 className="text-lg font-bold text-gray-900 mb-3">{t('dashboard.quick_links')}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { href: '/feed', icon: '\ud83d\udcf0', label: t('nav.feed') },
              { href: '/stats', icon: '\ud83d\udcca', label: t('nav.stats') },
              { href: '/rankings', icon: '\ud83c\udfc6', label: t('nav.rankings') },
              { href: '/eu-life', icon: '\ud83c\udf0d', label: t('nav.eu_life') },
              { href: '/ask', icon: '\ud83d\udcac', label: t('nav.ask') },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-gray-100 bg-white p-4 card-hover text-center group"
              >
                <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">{link.icon}</span>
                <p className="text-sm font-semibold text-gray-900">{link.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatValue(value: number, unit: string): string {
  if (unit === 'EUR/month') return `\u20ac${Math.round(value)}/mo`;
  if (unit === 'EUR/year') return `\u20ac${Math.round(value).toLocaleString()}`;
  if (unit === 'years') return `${value.toFixed(1)} yr`;
  if (unit === 'tonnes') return `${value.toFixed(1)}t`;
  return `${value.toFixed(1)}${unit}`;
}
