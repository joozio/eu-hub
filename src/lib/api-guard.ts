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

function lastHop(value: string | null): string {
  if (!value) return '';
  const hops = value.split(',').map((hop) => hop.trim()).filter(Boolean);
  return hops[hops.length - 1] || '';
}

export function getClientIp(req: NextRequest): string {
  // Optional override for deployments whose edge sets a dedicated header (e.g. cf-connecting-ip).
  const trustedHeader = (process.env.TRUSTED_CLIENT_IP_HEADER || '').trim().toLowerCase();
  if (trustedHeader) {
    const trusted = lastHop(req.headers.get(trustedHeader));
    if (trusted) return trusted;
  }

  // Proxies append the peer address, so only the last hop is trustworthy.
  // Earlier entries are client-supplied and would let anyone rotate rate-limit buckets.
  const forwarded = lastHop(req.headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;
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

// Browsers can send text/plain POSTs cross-site without a CORS preflight. Requiring
// application/json forces a preflight, which fails because no CORS headers are served.
export function requireJsonContentType(req: NextRequest): NextResponse | null {
  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type === 'application/json') return null;
  return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
}

export function asHttpUrl(value: unknown, maxLen = 500): string {
  const raw = asTrimmedString(value, maxLen);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
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
