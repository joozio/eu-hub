'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { getLang } from '@/lib/i18n';
import { t as translate } from '@/lib/translations';
import { getCountryName } from '@/lib/countries';

const DEFAULTS: UserProfile = { country: '', age: 30 };

export function useProfile(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
      const saved = localStorage.getItem('userProfile');
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem('userProfile');
        if (saved) {
          const next = { ...DEFAULTS, ...JSON.parse(saved) };
          setProfile(prev => {
            if (
              prev.country === next.country &&
              prev.age === next.age &&
              prev.employmentStatus === next.employmentStatus &&
              prev.industry === next.industry &&
              prev.housingStatus === next.housingStatus &&
              prev.isParent === next.isParent &&
              prev.relationshipStatus === next.relationshipStatus &&
              JSON.stringify(prev.priorityThemes || []) === JSON.stringify(next.priorityThemes || [])
            ) return prev;
            return next;
          });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', read);
    window.addEventListener('profileUpdate', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('profileUpdate', read);
    };
  }, []);

  return profile;
}

// Country code to flag emoji
const FLAG_OFFSET = 0x1F1E6 - 'A'.charCodeAt(0);
export function countryFlag(code: string): string {
  if (code.length !== 2) return '';
  return String.fromCodePoint(
    code.charCodeAt(0) + FLAG_OFFSET,
    code.charCodeAt(1) + FLAG_OFFSET
  );
}

export function countryName(code: string): string {
  return getCountryName(code);
}

/**
 * Translation hook - returns t() function bound to the user's language.
 * Also updates <html lang> attribute.
 */
export function useTranslation() {
  const profile = useProfile();
  const lang = getLang(profile.country);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string) => translate(lang, key);

  return { t, lang, profile };
}
