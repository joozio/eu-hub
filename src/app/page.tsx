'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CountrySelector from '@/components/CountrySelector';
import AgeSelector from '@/components/AgeSelector';
import { UserProfile } from '@/types';
import { useTranslation } from '@/hooks/useProfile';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    country: '',
    age: 30,
  });
  const [showMore, setShowMore] = useState(false);

  const { t, lang } = useTranslation();

  // Auto-redirect returning users to dashboard
  useEffect(() => {
    try {
      const saved = localStorage.getItem('userProfile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.country) {
          router.replace('/dashboard');
          return;
        }
      }
    } catch { /* continue to landing */ }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('userProfile', JSON.stringify(profile));
    window.dispatchEvent(new Event('profileUpdate'));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />

      {/* Floating gradient orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-600/10 blur-3xl animate-float-1" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-amber-400/10 to-blue-400/10 blur-3xl animate-float-2" />

      {/* Subtle dot pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <main className="relative container mx-auto px-4 py-16 sm:py-24 flex flex-col items-center">
        {/* Animated EU stars ring */}
        <div className="mb-8 animate-star-rotate">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = 40 + 30 * Math.cos(angle);
              const y = 40 + 30 * Math.sin(angle);
              return (
                <g key={i}>
                  <polygon
                    points={starPoints(x, y, 5, 2.5)}
                    fill="#FFCC00"
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 204, 0, 0.4))' }}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hero text */}
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-black text-white mb-3 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('landing.title')}
          </h1>
          <div className="w-12 h-0.5 bg-eu-gold mx-auto mb-4 rounded-full" />
          <p className="text-lg sm:text-xl text-white/80 max-w-lg mx-auto leading-relaxed">
            {t('landing.subtitle')}
          </p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-8 border border-white/40">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {t('landing.form')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('landing.country')}
              </label>
              <CountrySelector
                onSelect={(country) => setProfile({ ...profile, country })}
                selectedCountry={profile.country}
                searchPlaceholder={t('common.search')}
                placeholder={t('landing.select_country')}
                noResultsText={t('country.no_results')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('landing.age')}
              </label>
              <AgeSelector
                age={profile.age}
                onChange={(age) => setProfile({ ...profile, age })}
              />
            </div>

            {/* Expandable extra profile fields */}
            <div>
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-2 text-sm text-eu-blue hover:text-eu-blue-vivid font-medium transition-colors w-full justify-center"
              >
                {showMore ? t('landing.less_options') : t('landing.more_personalization')}
                <svg
                  className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMore && (
                <div className="mt-4 space-y-4 animate-slide-up">
                  <div className="grid grid-cols-2 gap-3">
                    <LandingSelect
                      label={t('profile.relationship')}
                      value={profile.relationshipStatus || ''}
                      onChange={(v) => setProfile({...profile, relationshipStatus: v})}
                      options={[
                        { value: '', label: t('opt.select') },
                        { value: 'single', label: t('opt.single') },
                        { value: 'married', label: t('opt.married') },
                        { value: 'partnership', label: t('opt.partnership') },
                        { value: 'divorced', label: t('opt.divorced') },
                      ]}
                    />
                    <LandingSelect
                      label={t('profile.employment')}
                      value={profile.employmentStatus || ''}
                      onChange={(v) => setProfile({...profile, employmentStatus: v})}
                      options={[
                        { value: '', label: t('opt.select') },
                        { value: 'employed', label: t('opt.employed') },
                        { value: 'self-employed', label: t('opt.self_employed') },
                        { value: 'student', label: t('opt.student') },
                        { value: 'retired', label: t('opt.retired') },
                        { value: 'unemployed', label: t('opt.unemployed') },
                      ]}
                    />
                    <LandingSelect
                      label={t('profile.industry')}
                      value={profile.industry || ''}
                      onChange={(v) => setProfile({...profile, industry: v})}
                      options={[
                        { value: '', label: t('opt.select') },
                        { value: 'tech', label: t('opt.tech') },
                        { value: 'healthcare', label: t('opt.healthcare') },
                        { value: 'education', label: t('opt.education') },
                        { value: 'finance', label: t('opt.finance') },
                        { value: 'agriculture', label: t('opt.agriculture') },
                        { value: 'manufacturing', label: t('opt.manufacturing') },
                        { value: 'services', label: t('opt.services') },
                      ]}
                    />
                    <LandingSelect
                      label={t('profile.housing')}
                      value={profile.housingStatus || ''}
                      onChange={(v) => setProfile({...profile, housingStatus: v})}
                      options={[
                        { value: '', label: t('opt.select') },
                        { value: 'homeowner', label: t('opt.homeowner') },
                        { value: 'renter', label: t('opt.renter') },
                        { value: 'with-family', label: t('opt.family') },
                        { value: 'other', label: t('opt.other_housing') },
                      ]}
                    />
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      profile.isParent ? 'bg-eu-blue border-eu-blue' : 'border-gray-300 group-hover:border-gray-400'
                    }`}>
                      {profile.isParent && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.isParent || false}
                      onChange={(e) => setProfile({...profile, isParent: e.target.checked})}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-slate-700">{t('profile.parent')}</span>
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!profile.country}
              className="w-full bg-gradient-to-r from-eu-blue to-eu-blue-vivid text-white font-semibold py-3.5 px-4 rounded-xl transition-all hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {t('landing.submit')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </form>
        </div>

        {/* Feed Preview (Demo Polish) */}
        <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-white/80">{t('landing.preview_title')}</span>
            <span className="text-xs bg-white/20 text-white/60 px-2 py-0.5 rounded-full">📍 {t('landing.personalized')}</span>
          </div>
          <div className="space-y-3">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Legislation</span>
                <span className="text-xs text-white/50">EU Commission</span>
              </div>
              <h3 className="text-sm font-semibold text-white/90 line-clamp-1">EU AI Act - Full Application from August 2025</h3>
              <p className="text-xs text-white/70 line-clamp-2">The world's first comprehensive AI regulation establishing risk-based rules for AI systems across all EU member states.</p>
              <p className="text-xs text-white/60 mt-1">Mar 3, 2026</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Proposal</span>
                <span className="text-xs text-white/50">European Council</span>
              </div>
              <h3 className="text-sm font-semibold text-white/90 line-clamp-1">Digital Euro Proposal - New EU Currency for the Digital Age</h3>
              <p className="text-xs text-white/70 line-clamp-2">The ECB is preparing a digital euro for all eurozone citizens, free to use and privacy-preserving.</p>
              <p className="text-xs text-white/60 mt-1">Mar 1, 2026</p>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-3 text-center italic">{t('landing.preview_subtitle')}</p>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex items-center gap-4 text-white/50 text-xs">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            {t('landing.powered')}
          </span>
        </div>
      </main>
    </div>
  );
}

function LandingSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-eu-blue-vivid/50 focus:border-eu-blue-vivid outline-none transition-all bg-white"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 72 - 90) * (Math.PI / 180);
    const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
    points.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`);
    points.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`);
  }
  return points.join(' ');
}
