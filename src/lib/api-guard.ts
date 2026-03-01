import { NextRequest, NextResponse } from 'next/server';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

const rateLimitBuckets = new Map<string, Bucket>();

function cleanupBuckets(now: number) {
  if (rateLimitBuckets.size < 5000) return;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return (
    req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
  );
}

export function checkRateLimit(req: NextRequest, options: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  cleanupBuckets(now);

  const bucketKey = `${options.key}:${getClientIp(req)}`;
  const existing = rateLimitBuckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (existing.count >= options.max) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    );
  }

  existing.count += 1;
  rateLimitBuckets.set(bucketKey, existing);
  return null;
}

export function asTrimmedString(value: unknown, maxLen = 120): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

export function asAge(value: unknown, fallback = 30): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.floor(n);
  return Math.min(100, Math.max(13, int));
}

export function asCountryCode(value: unknown): string {
  const code = asTrimmedString(value, 16).toUpperCase();
  if (/^[A-Z]{2}$/.test(code) || code === 'EU27_2020') return code;
  return '';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: (RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }) = {},
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
