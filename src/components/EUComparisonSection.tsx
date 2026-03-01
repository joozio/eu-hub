'use client';

import { useState } from 'react';
import { EU_COMPARISONS } from '@/lib/eu-comparisons';
import { UserProfile } from '@/types';
import { scoreComparisonItem } from '@/lib/personalization';

const SENTIMENT_STYLES = {
  positive: 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100/50 dark:bg-emerald-950/25 dark:border-emerald-800/80 dark:hover:border-emerald-700',
  negative: 'bg-red-50/60 border-red-200 hover:border-red-300 hover:shadow-red-100/50 dark:bg-red-950/25 dark:border-red-800/80 dark:hover:border-red-700',
  neutral: 'bg-amber-50/60 border-amber-200 hover:border-amber-300 hover:shadow-amber-100/50 dark:bg-amber-950/25 dark:border-amber-800/80 dark:hover:border-amber-700',
};

const SENTIMENT_BADGE_KEYS: Record<string, string> = {
  positive: 'dashboard.eu_better',
  negative: 'dashboard.eu_worse',
  neutral: 'dashboard.neutral',
};

interface Props {
  t: (key: string) => string;
  insight?: string;
  insightLoading?: boolean;
  onRequestInsight?: () => void;
  expandedByDefault?: boolean;
  sentimentFilter?: 'positive' | 'negative' | 'neutral';
  profile?: UserProfile;
}

export default function EUComparisonSection({ t, insight, insightLoading, onRequestInsight, expandedByDefault, sentimentFilter, profile }: Props) {
  const [expanded, setExpanded] = useState(expandedByDefault ?? false);
  const filtered = (sentimentFilter
    ? EU_COMPARISONS.filter(c => c.sentiment === sentimentFilter)
    : EU_COMPARISONS)
    .map((item) => ({ item, scored: profile ? scoreComparisonItem(profile, item) : null }))
    .sort((a, b) => (b.scored?.score || 0) - (a.scored?.score || 0));
  const visibleItems = expanded ? filtered : filtered.slice(0, 6);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('dashboard.eu_vs_world')}</h2>
          <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{t('dashboard.life_in_eu')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleItems.map(({ item, scored }, idx) => (
          <div
            key={item.id}
            className={`card-spotlight rounded-xl border p-4 transition-all animate-slide-up hover:shadow-md flex flex-col overflow-hidden ${SENTIMENT_STYLES[item.sentiment]}`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0">{item.icon}</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">{t(`eu_compare.${item.id}`) !== `eu_compare.${item.id}` ? t(`eu_compare.${item.id}`) : item.topic}</h3>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                item.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200' :
                item.sentiment === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
              }`}>
                {t(SENTIMENT_BADGE_KEYS[item.sentiment])}
              </span>
            </div>
            <div className="space-y-2.5 flex-1">
              <div className="bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-slate-700/80 rounded-lg p-2.5">
                <p className="text-xs font-bold text-eu-blue dark:text-blue-300 uppercase tracking-wider mb-0.5">{t('eu_compare.eu_label')}</p>
                <p className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed">{item.euValue}</p>
              </div>
              <div className="bg-white/55 dark:bg-slate-900/65 border border-white/30 dark:border-slate-700/70 rounded-lg p-2.5">
                <p className="text-xs font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider mb-0.5">{t('eu_compare.global_label')}</p>
                <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{item.worldAvg}</p>
              </div>
            </div>
            {scored && scored.reasons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scored.reasons.slice(0, 2).map((reason) => (
                  <span key={reason} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/60">
                    {reason}
                  </span>
                ))}
              </div>
            )}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-eu-blue dark:hover:text-blue-300 transition-colors max-w-full"
              title={item.source}
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="truncate max-w-[calc(100%-1rem)]">{item.source}</span>
            </a>
          </div>
        ))}
      </div>

      {filtered.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-eu-blue dark:text-blue-300 hover:text-eu-blue-vivid dark:hover:text-blue-200 font-medium transition-colors"
        >
          {expanded ? t('landing.less_options') : `${t('dashboard.view_all')} (${filtered.length})`}
        </button>
      )}

      {/* Mistral AI insight */}
      <div className="mt-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-slate-800/90 dark:to-slate-700/80 border border-blue-100/50 dark:border-slate-600/70 p-4">
        {!insight && !insightLoading && onRequestInsight && (
          <button
            onClick={onRequestInsight}
            className="w-full flex items-center justify-center gap-2 py-2 text-eu-blue dark:text-blue-300 font-semibold hover:text-eu-blue-vivid dark:hover:text-blue-200 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {t('stats.insight')}
          </button>
        )}
        {insightLoading && (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-eu-blue rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <span className="text-sm text-gray-500 dark:text-slate-300">{t('stats.analyzing')}</span>
          </div>
        )}
        {insight && (
          <div className="animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 bg-gradient-to-br from-eu-blue to-eu-blue-vivid rounded-lg flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
                </svg>
              </span>
              <span className="text-xs font-semibold text-gray-800 dark:text-slate-100">{t('stats.label')}</span>
              <span className="text-xs text-gray-500 dark:text-slate-300 ml-auto">Mistral AI</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}
