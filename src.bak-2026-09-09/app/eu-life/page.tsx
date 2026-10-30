'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useProfile';
import EUComparisonSection from '@/components/EUComparisonSection';
import { EU_COMPARISONS } from '@/lib/eu-comparisons';
import { ShareButton } from '@/components/ui/share-button';
import { GlossaryTip } from '@/components/ui/glossary-tip';

export default function EULifePage() {
  const router = useRouter();
  const { t, lang, profile } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  const positiveCount = EU_COMPARISONS.filter(c => c.sentiment === 'positive').length;
  const negativeCount = EU_COMPARISONS.filter(c => c.sentiment === 'negative').length;
  const neutralCount = EU_COMPARISONS.filter(c => c.sentiment === 'neutral').length;

  const handleInsight = async () => {
    setInsightLoading(true);
    try {
      const res = await fetch('/api/eu-comparison-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: profile.country,
          age: profile.age,
          employmentStatus: profile.employmentStatus,
          lang,
        }),
      });
      const data = await res.json();
      setInsight(data.insight || '');
    } catch { /* ignore */ }
    finally { setInsightLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-indigo-500/10 to-blue-600/5 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              {t('eu_life.title')}
            </h1>
            <ShareButton title="Life in the EU vs the World" text="Compare the EU with the rest of the world on EU Hub" size="sm" className="shrink-0 mt-1" />
          </div>
          <p className="text-white/80 text-sm sm:text-base max-w-2xl mb-6">
            Data sourced from <GlossaryTip term="Eurostat">Eurostat</GlossaryTip>, official <GlossaryTip term="Directive">EU Directives</GlossaryTip> and <GlossaryTip term="Regulation">Regulations</GlossaryTip>.
          </p>

          {/* Filter badges */}
          <div className="flex flex-wrap gap-2">
            <FilterBadge
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
              color="white"
              count={EU_COMPARISONS.length}
              label={t('feed.all')}
            />
            <FilterBadge
              active={activeFilter === 'positive'}
              onClick={() => setActiveFilter('positive')}
              color="emerald"
              count={positiveCount}
              label={t('eu_life.positive_count')}
            />
            <FilterBadge
              active={activeFilter === 'negative'}
              onClick={() => setActiveFilter('negative')}
              color="red"
              count={negativeCount}
              label={t('eu_life.negative_count')}
            />
            <FilterBadge
              active={activeFilter === 'neutral'}
              onClick={() => setActiveFilter('neutral')}
              color="amber"
              count={neutralCount}
              label={t('eu_life.neutral_count')}
            />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <EUComparisonSection
          t={t}
          insight={insight}
          insightLoading={insightLoading}
          onRequestInsight={handleInsight}
          expandedByDefault
          sentimentFilter={activeFilter === 'all' ? undefined : activeFilter}
        />
      </main>
    </div>
  );
}

function FilterBadge({
  active, onClick, color, count, label,
}: {
  active: boolean;
  onClick: () => void;
  color: 'white' | 'emerald' | 'red' | 'amber';
  count: number;
  label: string;
}) {
  const baseColors = {
    white: active ? 'bg-white text-gray-900' : 'bg-white/10 text-white/70 hover:bg-white/20',
    emerald: active ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
    red: active ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-300 hover:bg-red-500/20',
    amber: active ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${baseColors[color]}`}
    >
      <span>{count}</span>
      <span>{label}</span>
    </button>
  );
}
