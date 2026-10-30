'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation, countryName, countryFlag } from '@/hooks/useProfile';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { FeedItem } from '@/types';

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

  useEffect(() => {
    if (!profile.country) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      const [liveResult, curatedResult] = await Promise.allSettled([
        fetch(`/api/eu-feed?country=${profile.country}&age=${profile.age}`).then(r => r.json()),
        import('@/services/api').then(m => m.fetchLatestEUContent(profile.country, profile.age)),
      ]);

      if (liveResult.status === 'fulfilled' && liveResult.value.success) {
        setLiveItems(liveResult.value.data);
      }
      if (curatedResult.status === 'fulfilled' && curatedResult.value.success) {
        setCuratedItems(curatedResult.value.data);
      }
      if (liveResult.status === 'rejected' && curatedResult.status === 'rejected') {
        setError(t('common.error'));
      }
      setLoading(false);
    };
    fetchAll();
  }, [profile.country, profile.age]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <div className="h-8 w-48 bg-gray-100 rounded-lg animate-shimmer mb-2" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-shimmer" />
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{t('common.error')}</h2>
          <p className="text-slate-500 mb-6 text-sm">{error}</p>
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

  const allLive = [...liveItems].sort((a, b) => b.relevanceScore - a.relevanceScore);
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
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{t('feed.title')}</h1>
              <p className="text-white/70 text-sm mt-1">{t('feed.subtitle')}</p>
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
                  <div className={`p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all hover:-translate-y-0.5 border-l-[3px] ${TYPE_COLORS[item.type] || ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={item.type} dot>{t('feed.type.' + item.type)}</Badge>
                      <RelevanceRing score={item.relevanceScore} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-eu-blue transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
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
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
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
              <h2 className="text-lg font-bold text-foreground">{t('feed.laws')}</h2>
            </div>
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
              {t('feed.laws_note')}
            </div>
            <div className="grid gap-4">
              {curatedItems.map((item) => (
                <ContentCard key={item.id} content={item} isLive={false} t={t} lang={lang} />
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
  style,
}: {
  content: FeedItem;
  isLive: boolean;
  t: (key: string) => string;
  lang: string;
  style?: React.CSSProperties;
}) {
  const source = SOURCE_INITIALS[content.source || ''];

  return (
    <div
      className={`animate-slide-up rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden border-l-[3px] ${TYPE_COLORS[content.type] || 'border-l-gray-300'}`}
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
            <span className="text-xs text-gray-500">
              {new Date(content.date).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <RelevanceRing score={content.relevanceScore} />
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">{content.title}</h3>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed mb-3">{content.description}</p>

        {/* AI Summary */}
        {content.summary && (
          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 rounded-xl mb-3 border border-blue-100/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
              </svg>
              <span className="text-xs font-semibold text-blue-700">{t('feed.means')}</span>
              <span className="text-xs text-blue-500 ml-auto">Mistral AI</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{content.summary}</p>
          </div>
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

function RelevanceRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
        <circle
          cx="16" cy="16" r={radius}
          fill="none"
          stroke={pct >= 70 ? '#3b82f6' : pct >= 40 ? '#6366f1' : '#94a3b8'}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">
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
