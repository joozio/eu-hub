'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation, countryName, countryFlag } from '@/hooks/useProfile';
import { withClientDemoParam } from '@/lib/demo-mode';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { FeedItem } from '@/types';
import { scoreFeedLikeItem } from '@/lib/personalization';

const TYPE_COLORS: Record<string, string> = {
  legislation: 'border-l-indigo-500',
  news: 'border-l-violet-500',
  proposal: 'border-l-amber-500',
  statistic: 'border-l-emerald-500',
};

const SOURCE_INITIALS: Record<string, { label: string; color: string }> = {
  'European Parliament': { label: 'EP', color: 'bg-indigo-500' },
  'European Commission': { label: 'EC', color: 'bg-blue-500' },
};

interface FeedMeta {
  generatedAt: string;
  freshness: 'live' | 'cached' | 'stale' | 'snapshot';
  sourceHealth: 'ok' | 'degraded';
}

interface RankedItem extends FeedItem {
  relevanceReasons: string[];
  personalizedScore: number;
}

function FeedContent() {
  const router = useRouter();
  const { t, lang, profile } = useTranslation();

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);
  const [curatedItems, setCuratedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [feedMeta, setFeedMeta] = useState<FeedMeta | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (!profile.country) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      const [liveResult, curatedResult] = await Promise.allSettled([
        fetch(withClientDemoParam(`/api/eu-feed?country=${profile.country}&age=${profile.age}`)).then(r => r.json()),
        import('@/services/api').then(m => m.fetchLatestEUContent(profile.country, profile.age)),
      ]);

      if (liveResult.status === 'fulfilled' && liveResult.value.success) {
        setLiveItems(liveResult.value.data);
        if (liveResult.value.meta) setFeedMeta(liveResult.value.meta as FeedMeta);
      }
      if (curatedResult.status === 'fulfilled' && curatedResult.value.success) {
        setCuratedItems(curatedResult.value.data);
      }
      if (liveResult.status === 'rejected' && curatedResult.status === 'rejected') {
        setError('common.error');
      }
      setLoading(false);
    };
    fetchAll();
  }, [profile.country, profile.age]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rankedLive = useMemo<RankedItem[]>(() => (
    liveItems.map((item) => {
      const scored = scoreFeedLikeItem(profile, item);
      return {
        ...item,
        relevanceScore: scored.score,
        personalizedScore: scored.score,
        relevanceReasons: scored.reasons.slice(0, 2),
      };
    })
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
  ), [liveItems, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <div className="h-8 w-48 bg-gray-100 dark:bg-slate-700 rounded-lg animate-shimmer mb-2" />
            <div className="h-4 w-64 bg-gray-100 dark:bg-slate-700 rounded animate-shimmer" />
          </div>
          <div className="grid gap-4">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  if (error && liveItems.length === 0 && curatedItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{t('common.error')}</h2>
          <p className="text-slate-500 dark:text-slate-300 mb-6 text-sm">{t(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-eu-blue text-white px-6 py-2.5 rounded-xl hover:bg-eu-blue-dark font-medium text-sm transition-all hover:shadow-lg"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const allLive = rankedLive;
  const filtered = activeFilter === 'all'
    ? allLive
    : allLive.filter(item => item.type === activeFilter);

  const filters = [
    { key: 'all', label: t('feed.all') || 'All' },
    { key: 'legislation', label: t('feed.type.legislation') },
    { key: 'news', label: t('feed.type.news') },
    { key: 'proposal', label: t('feed.type.proposal') },
    { key: 'statistic', label: t('feed.type.statistic') },
  ];

  // Top 3 stories for the hero strip
  const topStories = allLive.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Hero banner */}
      <div className="hero-mesh hero-tone-feed">
        <div className="hero-content max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('feed.title')}</h1>
              <p className="text-white/70 text-sm mt-1">{t('feed.subtitle')}</p>
              {feedMeta && (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                  <span className={`px-2 py-0.5 rounded-full border ${
                    feedMeta.sourceHealth === 'ok'
                      ? 'bg-emerald-500/20 border-emerald-300/40'
                      : 'bg-amber-500/20 border-amber-300/40'
                  }`}>
                    {feedMeta.sourceHealth === 'ok' ? 'Sources healthy' : 'Sources degraded'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-white/20 bg-white/10">
                    {feedMeta.freshness}
                  </span>
                  <span className="text-white/60">
                    Updated {new Date(feedMeta.generatedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              <span className="text-base">{countryFlag(profile.country)}</span>
              <span className="font-medium text-white/90">{countryName(profile.country)}</span>
              <span className="text-white/50">|</span>
              <span className="text-white/70">{profile.age}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Top stories strip */}
        {topStories.length > 0 && (
          <div className="mb-6 -mx-4 sm:mx-0">
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-0 snap-x snap-mandatory">
              {topStories.map((item) => (
                <a
                  key={`top-${item.id}`}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-[280px] snap-start group"
                >
                  <div className={`card-spotlight p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/70 hover:shadow-md transition-all hover:-translate-y-0.5 border-l-[3px] ${TYPE_COLORS[item.type] || ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={item.type} dot>{t('feed.type.' + item.type)}</Badge>
                      <RelevanceRing score={item.personalizedScore} isDark={isDark} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-eu-blue transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-300 mt-2">
                      {item.source} &middot; {timeAgo(item.date)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeFilter === f.key
                  ? 'bg-eu-blue text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900/70 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Feed cards */}
        <div className="grid gap-4">
          {filtered.length > 0 ? filtered.map((item, idx) => (
            <ContentCard
              key={item.id}
              content={item}
              isLive
              t={t}
              lang={lang}
              relevanceReasons={item.relevanceReasons}
              freshness={feedMeta?.freshness}
              lastUpdated={feedMeta?.generatedAt}
              isDark={isDark}
              style={{ animationDelay: `${idx * 60}ms` }}
            />
          )) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t('feed.empty')}</p>
            </div>
          )}
        </div>

        {/* Landmark laws section */}
        {curatedItems.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">&#9878;</span>
              <h2 className="text-lg font-bold text-foreground dark:text-slate-100">{t('feed.laws')}</h2>
            </div>
            <div className="bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/60 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700 dark:text-amber-200">
              {t('feed.laws_note')}
            </div>
            <div className="grid gap-4">
              {curatedItems.map((item) => (
                <ContentCard key={item.id} content={item} isLive={false} t={t} lang={lang} isDark={isDark} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>  );
}

function ContentCard({
  content,
  isLive,
  t,
  lang,
  relevanceReasons = [],
  freshness,
  lastUpdated,
  isDark = false,
  style,
}: {
  content: FeedItem;
  isLive: boolean;
  t: (key: string) => string;
  lang: string;
  relevanceReasons?: string[];
  freshness?: string;
  lastUpdated?: string;
  isDark?: boolean;
  style?: React.CSSProperties;
}) {
  const source = SOURCE_INITIALS[content.source || ''];

  return (
    <div
      className={`card-spotlight animate-slide-up rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/70 hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden border-l-[3px] ${TYPE_COLORS[content.type] || 'border-l-gray-300'}`}
      style={style}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {source && (
              <span className={`w-6 h-6 rounded-md ${source.color} flex items-center justify-center`}>
                <span className="text-[10px] font-bold text-white">{source.label}</span>
              </span>
            )}
            <Badge variant={content.type} dot>{t('feed.type.' + content.type)}</Badge>
            {isLive && <Badge variant="live" dot pulse>Live</Badge>}
            {isLive && freshness && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-300 uppercase">
                {freshness}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-slate-300">
              {new Date(content.date).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {isLive && Number.isFinite(content.relevanceScore) && (
            <RelevanceRing score={content.relevanceScore} isDark={isDark} />
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2 leading-snug">{content.title}</h3>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-3">{content.description}</p>

        {relevanceReasons.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {relevanceReasons.map((reason) => (
              <span key={reason} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-blue-800/70">
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* AI Summary */}
        {content.summary && (
          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-slate-800/90 dark:to-slate-700/80 p-4 rounded-xl mb-3 border border-blue-100/50 dark:border-slate-600/70">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
              </svg>
              <span className="text-xs font-semibold text-blue-700">{t('feed.means')}</span>
              <span className="text-xs text-blue-500 dark:text-blue-300 ml-auto">Mistral AI</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">{content.summary}</p>
          </div>
        )}

        {isLive && lastUpdated && (
          <p className="text-[11px] text-gray-400 dark:text-slate-400 mb-2">
            Updated {new Date(lastUpdated).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Read more */}
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors group"
        >
          {t('feed.read')}
          <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function RelevanceRing({ score, isDark }: { score: number; isDark: boolean }) {
  const safeScore = Number.isFinite(score) ? Math.min(Math.max(score, 0), 1) : 0;
  const pct = Math.round(safeScore * 100);
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeScore);

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={radius} fill="none" stroke={isDark ? '#475569' : '#e5e7eb'} strokeWidth="2.5" />
        <circle
          cx="16" cy="16" r={radius}
          fill="none"
          stroke={pct >= 70 ? '#60a5fa' : pct >= 40 ? '#818cf8' : (isDark ? '#94a3b8' : '#64748b')}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
        {pct}
      </span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function FeedPage() {
  return <FeedContent />;
}
