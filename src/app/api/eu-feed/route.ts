import { NextRequest } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';
import { FeedItem, FreshnessMode, SourceId } from '@/types';
import {
  asAge,
  asBoolean,
  asCountryCode,
  asTrimmedString,
  checkRateLimit,
  fetchWithTimeout,
} from '@/lib/api-guard';
import { parseRssItems } from '@/lib/rss';
import {
  getAggregateSourceHealth,
  makeProvenanceList,
  withSourceProbe,
} from '@/lib/source-registry';
import { getRequestDemoMode, shouldFallbackToSnapshot, shouldUseSnapshot } from '@/lib/demo-mode';
import { jsonWithRequestId } from '@/lib/request-id';
import feedSnapshot from '@/data/demo/feed.json';

const EP_RSS_URL = 'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml';
const EC_RSS_URL = 'https://ec.europa.eu/commission/presscorner/api/rss?language=en';

const feedCache = new Map<string, { items: FeedItem[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;
// Keys include free-text profile fields, so the cache must not grow without limit.
const MAX_FEED_CACHE_ENTRIES = 500;

function setFeedCache(key: string, items: FeedItem[]) {
  feedCache.delete(key);
  while (feedCache.size >= MAX_FEED_CACHE_ENTRIES) {
    const oldest = feedCache.keys().next().value;
    if (oldest === undefined) break;
    feedCache.delete(oldest);
  }
  feedCache.set(key, { items, timestamp: Date.now() });
}

interface FeedResponseMeta {
  generatedAt: string;
  freshness: FreshnessMode;
  sourceHealth: 'ok' | 'degraded';
  provenance: ReturnType<typeof makeProvenanceList>;
  demoMode: 'off' | 'hybrid' | 'snapshot';
}

function makeMeta(options: {
  freshness: FreshnessMode;
  generatedAt?: string;
  sourceIds: SourceId[];
  demoMode: 'off' | 'hybrid' | 'snapshot';
}): FeedResponseMeta {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    freshness: options.freshness,
    sourceHealth: getAggregateSourceHealth(options.sourceIds),
    provenance: makeProvenanceList(options.sourceIds, options.freshness, options.generatedAt),
    demoMode: options.demoMode,
  };
}

async function fetchRawItems(): Promise<FeedItem[]> {
  const [epResult, ecResult] = await Promise.allSettled([
    withSourceProbe('ep_rss', async () => {
      const response = await fetchWithTimeout(EP_RSS_URL, { next: { revalidate: 1800 } }, 12_000);
      if (!response.ok) throw new Error(`EP RSS: ${response.status}`);
      return response.text();
    }),
    withSourceProbe('ec_presscorner', async () => {
      const response = await fetchWithTimeout(EC_RSS_URL, { next: { revalidate: 1800 } }, 12_000);
      if (!response.ok) throw new Error(`EC RSS: ${response.status}`);
      return response.text();
    }),
  ]);

  const epItems = epResult.status === 'fulfilled' ? parseRssItems(epResult.value, 'European Parliament') : [];
  const ecItems = ecResult.status === 'fulfilled' ? parseRssItems(ecResult.value, 'European Commission') : [];

  return [...epItems, ...ecItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}

async function translateAndScore(
  items: FeedItem[],
  language: string,
  profileContext: string,
): Promise<FeedItem[]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || items.length === 0) return items;

  const result = items.map((item) => ({ ...item }));

  try {
    const itemList = result.map((item, i) =>
      `${i + 1}. "${item.title}" - ${item.description.slice(0, 150)}`
    ).join('\n');

    const isEnglish = language === 'English';
    const formatSpec = isEnglish
      ? `For each item, output exactly one line: SCORE|SUMMARY
- SCORE: 0.0-1.0 relevance (higher = more relevant to this person)
- SUMMARY: One sentence explaining what this means for them personally`
      : `For each item, output exactly one line: SCORE|TITLE|DESC|SUMMARY
- SCORE: 0.0-1.0 relevance (higher = more relevant to this person)
- TITLE: The news title translated into ${language}
- DESC: The description translated into ${language} (1-2 sentences, keep it concise)
- SUMMARY: One sentence in ${language} explaining what this means for them personally`;

    const response = await withSourceProbe('mistral', () => fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{
          role: 'system',
          content: `You score EU news items for relevance to a person who is ${profileContext}, and write personal summaries.

IMPORTANT: Write all output in ${language}.

${formatSpec}

Output ${result.length} lines, one per item, in order. No numbering, no extra text.`,
        }, {
          role: 'user',
          content: itemList,
        }],
        temperature: 0.2,
        max_tokens: isEnglish ? 1200 : 3000,
      }),
    }, 20_000));

    if (!response.ok) return result;

    const data = await response.json();
    const lines = (data.choices?.[0]?.message?.content || '')
      .split('\n')
      .filter((l: string) => l.includes('|'));

    for (let i = 0; i < Math.min(lines.length, result.length); i++) {
      const line = lines[i].replace(/^\d+\.\s*/, '');
      const parts = line.split('|');
      if (parts.length < 2) continue;

      const score = parseFloat(parts[0].trim());
      if (!Number.isNaN(score)) result[i].relevanceScore = Math.min(Math.max(score, 0), 1);

      if (isEnglish || parts.length === 2) {
        const summary = parts.slice(1).join('|').trim();
        if (summary) result[i].summary = summary;
      } else if (parts.length === 3) {
        if (parts[1]?.trim()) result[i].title = parts[1].trim();
        if (parts[2]?.trim()) result[i].summary = parts[2].trim();
      } else {
        if (parts[1]?.trim()) result[i].title = parts[1].trim();
        if (parts[2]?.trim()) result[i].description = parts[2].trim();
        if (parts.slice(3).join('|').trim()) result[i].summary = parts.slice(3).join('|').trim();
      }
    }
  } catch (error) {
    console.error('Mistral scoring failed (using defaults):', error);
  }

  result.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return result;
}

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-eu-feed', max: 60, windowMs: 60_000 });
  if (limited) return limited;

  const demoMode = getRequestDemoMode(req);

  const country = asCountryCode(req.nextUrl.searchParams.get('country'));
  const age = asAge(req.nextUrl.searchParams.get('age'), 30);
  const quick = req.nextUrl.searchParams.get('quick') === 'true';
  const employmentStatus = asTrimmedString(req.nextUrl.searchParams.get('employmentStatus'), 40);
  const industry = asTrimmedString(req.nextUrl.searchParams.get('industry'), 40);
  const isParent = asBoolean(req.nextUrl.searchParams.get('isParent'));
  const housingStatus = asTrimmedString(req.nextUrl.searchParams.get('housingStatus'), 40);

  if (!country) {
    return jsonWithRequestId(req, { success: false, data: [], source: 'error', error: 'Invalid country code' }, 400);
  }

  if (shouldUseSnapshot(demoMode)) {
    return jsonWithRequestId(req, {
      success: true,
      data: feedSnapshot.data,
      source: 'snapshot',
      meta: makeMeta({
        freshness: 'snapshot',
        sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
        demoMode,
      }),
    });
  }

  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);
  const cacheKey = `${country}:${age}:${employmentStatus}:${industry}:${housingStatus}:${isParent}`;

  try {
    const cached = feedCache.get(cacheKey);
    const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);

    if (quick) {
      if (isFresh) {
        return jsonWithRequestId(req, {
          success: true,
          data: cached.items,
          source: 'cached',
          meta: makeMeta({
            freshness: 'cached',
            generatedAt: new Date(cached.timestamp).toISOString(),
            sourceIds: ['ep_rss', 'ec_presscorner'],
            demoMode,
          }),
        });
      }

      const rawItems = await fetchRawItems();
      if (rawItems.length === 0) throw new Error('No items parsed');
      return jsonWithRequestId(req, {
        success: true,
        data: rawItems,
        source: 'live-raw',
        meta: makeMeta({
          freshness: 'live',
          sourceIds: ['ep_rss', 'ec_presscorner'],
          demoMode,
        }),
      });
    }

    if (isFresh) {
      return jsonWithRequestId(req, {
        success: true,
        data: cached.items,
        source: 'cached',
        meta: makeMeta({
          freshness: 'cached',
          generatedAt: new Date(cached.timestamp).toISOString(),
          sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
          demoMode,
        }),
      });
    }

    const rawItems = await fetchRawItems();
    if (rawItems.length === 0) throw new Error('No items parsed from any source');

    const profileParts: string[] = [`a ${age}-year-old in ${countryName}`];
    if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);
    if (industry) profileParts.push(`industry: ${industry}`);
    if (isParent) profileParts.push('is a parent');
    if (housingStatus) profileParts.push(`housing: ${housingStatus}`);

    const processedItems = await translateAndScore(rawItems, language, profileParts.join(', '));
    setFeedCache(cacheKey, processedItems);

    return jsonWithRequestId(req, {
      success: true,
      data: processedItems,
      source: 'live',
      meta: makeMeta({
        freshness: 'live',
        sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
        demoMode,
      }),
    });
  } catch (error) {
    console.error('EU feed fetch failed:', error);

    const stale = feedCache.get(cacheKey);
    if (stale) {
      return jsonWithRequestId(req, {
        success: true,
        data: stale.items,
        source: 'stale-cache',
        meta: makeMeta({
          freshness: 'stale',
          generatedAt: new Date(stale.timestamp).toISOString(),
          sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
          demoMode,
        }),
      });
    }

    if (shouldFallbackToSnapshot(demoMode)) {
      return jsonWithRequestId(req, {
        success: true,
        data: feedSnapshot.data,
        source: 'snapshot-fallback',
        meta: makeMeta({
          freshness: 'snapshot',
          sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
          demoMode,
        }),
      });
    }

    return jsonWithRequestId(req, {
      success: false,
      data: [],
      source: 'error',
      meta: makeMeta({
        freshness: 'stale',
        sourceIds: ['ep_rss', 'ec_presscorner', 'mistral'],
        demoMode,
      }),
    });
  }
}
