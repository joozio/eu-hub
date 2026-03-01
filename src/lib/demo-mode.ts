import { NextRequest } from 'next/server';

export type DemoMode = 'off' | 'hybrid' | 'snapshot';

const VALID_MODES = new Set<DemoMode>(['off', 'hybrid', 'snapshot']);

function parseDemoParam(value: string | null): DemoMode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return 'snapshot';
  if (VALID_MODES.has(normalized as DemoMode)) return normalized as DemoMode;
  return null;
}

export function getEnvDemoMode(): DemoMode {
  const raw = (process.env.NEXT_PUBLIC_DEMO_MODE || '').trim().toLowerCase();
  if (!raw) return 'off';
  if (VALID_MODES.has(raw as DemoMode)) return raw as DemoMode;
  throw new Error(`Invalid NEXT_PUBLIC_DEMO_MODE: ${process.env.NEXT_PUBLIC_DEMO_MODE}`);
}

export function getRequestDemoMode(req: NextRequest): DemoMode {
  const queryMode = parseDemoParam(req.nextUrl.searchParams.get('demo'));
  return queryMode ?? getEnvDemoMode();
}

export function getClientDemoMode(): DemoMode {
  if (typeof window === 'undefined') return getEnvDemoMode();
  const url = new URL(window.location.href);
  const queryMode = parseDemoParam(url.searchParams.get('demo'));
  return queryMode ?? getEnvDemoMode();
}

export function shouldUseSnapshot(mode: DemoMode): boolean {
  return mode === 'snapshot';
}

export function shouldFallbackToSnapshot(mode: DemoMode): boolean {
  return mode === 'hybrid' || mode === 'snapshot';
}
