'use client';

import { useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { getLang } from '@/lib/i18n';

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const lang = getLang(profile.country);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <>{children}</>;
}