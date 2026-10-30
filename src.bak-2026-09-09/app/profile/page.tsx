'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/types';
import { getLang } from '@/lib/i18n';
import { t } from '@/lib/translations';
import { countryFlag } from '@/hooks/useProfile';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('userProfile');
        return saved ? { country: '', age: 30, ...JSON.parse(saved) } : { country: '', age: 30 };
      } catch {
        return { country: '', age: 30 };
      }
    }
    return { country: '', age: 30 };
  });

  const lang = getLang(profile.country);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const tr = (key: string) => t(lang, key);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('userProfile', JSON.stringify(profile));
    window.dispatchEvent(new Event('profileUpdate'));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12 pb-24 md:pb-12">
      <main className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Profile summary card */}
        {profile.country && (
          <div className="mb-6 animate-slide-up">
            <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
              <span className="text-3xl">{countryFlag(profile.country)}</span>
              <div>
                <p className="font-semibold text-gray-900">{tr('profile.title')}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-600">{tr('common.age').toLowerCase()} {profile.age}</span>
                  {profile.employmentStatus && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-600">{tr('opt.' + profile.employmentStatus.replace('-', '_'))}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {tr('profile.title')}
            </h1>
            <p className="text-sm text-gray-600 mb-8">
              {tr('profile.subtitle')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal section */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{tr('profile.section_personal')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField
                    label={tr('profile.relationship')}
                    value={profile.relationshipStatus || ''}
                    onChange={(v) => setProfile({...profile, relationshipStatus: v})}
                    options={[
                      { value: '', label: tr('opt.select') },
                      { value: 'single', label: tr('opt.single') },
                      { value: 'married', label: tr('opt.married') },
                      { value: 'partnership', label: tr('opt.partnership') },
                      { value: 'divorced', label: tr('opt.divorced') },
                    ]}
                  />
                  <div className="flex items-end pb-2">
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
                      <span className="text-sm font-medium text-gray-700">{tr('profile.parent')}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Work section */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{tr('profile.section_work')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField
                    label={tr('profile.employment')}
                    value={profile.employmentStatus || ''}
                    onChange={(v) => setProfile({...profile, employmentStatus: v})}
                    options={[
                      { value: '', label: tr('opt.select') },
                      { value: 'employed', label: tr('opt.employed') },
                      { value: 'self-employed', label: tr('opt.self_employed') },
                      { value: 'student', label: tr('opt.student') },
                      { value: 'retired', label: tr('opt.retired') },
                      { value: 'unemployed', label: tr('opt.unemployed') },
                    ]}
                  />
                  <SelectField
                    label={tr('profile.industry')}
                    value={profile.industry || ''}
                    onChange={(v) => setProfile({...profile, industry: v})}
                    options={[
                      { value: '', label: tr('opt.select') },
                      { value: 'tech', label: tr('opt.tech') },
                      { value: 'healthcare', label: tr('opt.healthcare') },
                      { value: 'education', label: tr('opt.education') },
                      { value: 'finance', label: tr('opt.finance') },
                      { value: 'agriculture', label: tr('opt.agriculture') },
                      { value: 'manufacturing', label: tr('opt.manufacturing') },
                      { value: 'services', label: tr('opt.services') },
                    ]}
                  />
                  <SelectField
                    label={tr('profile.housing')}
                    value={profile.housingStatus || ''}
                    onChange={(v) => setProfile({...profile, housingStatus: v})}
                    options={[
                      { value: '', label: tr('opt.select') },
                      { value: 'homeowner', label: tr('opt.homeowner') },
                      { value: 'renter', label: tr('opt.renter') },
                      { value: 'with-family', label: tr('opt.family') },
                      { value: 'other', label: tr('opt.other_housing') },
                    ]}
                  />
                </div>
              </div>

              {/* Other details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tr('profile.other')}
                </label>
                <textarea
                  value={profile.otherDetails || ''}
                  onChange={(e) => setProfile({...profile, otherDetails: e.target.value})}
                  placeholder="..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-eu-blue-vivid/50 focus:border-eu-blue-vivid outline-none transition-all min-h-[100px] text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors px-4 py-2.5"
                >
                  {tr('profile.back')}
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-eu-blue to-eu-blue-vivid text-white font-semibold px-8 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98]"
                >
                  {tr('profile.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-eu-blue-vivid/50 focus:border-eu-blue-vivid outline-none transition-all text-sm bg-white"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
