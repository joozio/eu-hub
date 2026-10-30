'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation, countryFlag } from '@/hooks/useProfile';
import { LANG_NAMES } from '@/lib/i18n';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function Navigation() {
  const pathname = usePathname();
  const { t, lang, profile } = useTranslation();

  if (pathname === '/') return null;

  return (
    <nav className="glass sticky top-0 z-50 border-b border-white/20 transition-shadow duration-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-eu-blue hover:text-eu-blue-vivid transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>
              <EUStarsIcon className="w-5 h-5" />
              EU Hub
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <NavLink href="/dashboard" current={pathname === '/dashboard'} suppressHydrationWarning>{t('nav.home')}</NavLink>
              <NavLink href="/feed" current={pathname === '/feed'} suppressHydrationWarning>{t('nav.feed')}</NavLink>
              <NavLink href="/stats" current={pathname === '/stats'} suppressHydrationWarning>{t('nav.stats')}</NavLink>
              <NavLink href="/rankings" current={pathname === '/rankings'} suppressHydrationWarning>{t('nav.rankings')}</NavLink>
              <NavLink href="/compare" current={pathname === '/compare'}>Compare</NavLink>
              <NavLink href="/eu-life" current={pathname === '/eu-life'} suppressHydrationWarning>{t('nav.eu_life')}</NavLink>
              <NavLink href="/ask" current={pathname === '/ask'} suppressHydrationWarning>{t('nav.ask')}</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link href="/profile" suppressHydrationWarning className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 glass-subtle px-3 py-1.5 rounded-full hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all">
              {profile.country ? (
                <>
                  <span className="text-base">{countryFlag(profile.country)}</span>
                  <span className="hidden sm:inline text-xs text-gray-600">{LANG_NAMES[lang]}</span>
                </>
              ) : (
                <span className="text-xs text-gray-600">{LANG_NAMES[lang] || 'English'}</span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname === '/') return null;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-white/20 pb-safe">
      <div className="flex items-center justify-around h-16">
        <MobileNavItem href="/dashboard" current={pathname === '/dashboard'} icon={<HomeIcon />} suppressHydrationWarning>
          {t('nav.home')}
        </MobileNavItem>
        <MobileNavItem href="/feed" current={pathname === '/feed'} icon={<FeedIcon />} suppressHydrationWarning>
          {t('nav.feed')}
        </MobileNavItem>
        <MobileNavItem href="/stats" current={pathname === '/stats'} icon={<StatsIcon />} suppressHydrationWarning>
          {t('nav.stats')}
        </MobileNavItem>
        <MobileNavItem href="/rankings" current={pathname === '/rankings'} icon={<RankingsIcon />} suppressHydrationWarning>
          {t('nav.rankings')}
        </MobileNavItem>
        <MobileNavItem href="/ask" current={pathname === '/ask'} icon={<AskIcon />} suppressHydrationWarning>
          {t('nav.ask')}
        </MobileNavItem>
      </div>
    </nav>
  );
}

function NavLink({ href, current, children, suppressHydrationWarning }: { href: string; current: boolean; children: React.ReactNode; suppressHydrationWarning?: boolean }) {
  return (
    <Link
      href={href}
      suppressHydrationWarning={suppressHydrationWarning}
      className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        current
          ? 'text-eu-blue bg-eu-blue/5'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {children}
      {current && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-eu-blue-vivid rounded-full" />
      )}
    </Link>
  );
}

function MobileNavItem({ href, current, icon, children, suppressHydrationWarning }: { href: string; current: boolean; icon: React.ReactNode; children: React.ReactNode; suppressHydrationWarning?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 transition-colors ${
        current ? 'text-eu-blue' : 'text-gray-500'
      }`}
    >
      {current && <span className="w-1 h-1 rounded-full bg-eu-blue-vivid mb-0.5" />}
      <span className="w-5 h-5">{icon}</span>
      <span suppressHydrationWarning={suppressHydrationWarning} className={`text-[11px] truncate max-w-[56px] ${current ? 'font-semibold' : 'font-medium'}`}>{children}</span>
    </Link>
  );
}

function EUStarsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#FFCC00" strokeWidth="1.5" fill="none" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = 12 + 7 * Math.cos(angle);
        const y = 12 + 7 * Math.sin(angle);
        return <circle key={i} cx={x} cy={y} r="1" fill="#FFCC00" />;
      })}
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RankingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21V11M16 21V7M12 21V3" />
      <path d="M12 3l-2 2M12 3l2 2" />
    </svg>
  );
}

function EULifeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function AskIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
