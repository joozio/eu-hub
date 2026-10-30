import { NextRequest, NextResponse } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';
import { FeedItem } from '@/types';

const EP_RSS_URL = 'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml';
const EC_RSS_URL = 'https://ec.europa.eu/commission/presscorner/api/rss?language=en';

// In-memory cache: key = "country:age" -> { items, timestamp }
const feedCache = new Map<string, { items: FeedItem[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function parseRSS(xml: string, sourceName: string = 'European Parliament'): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/^Press release - /, '').trim() || '';
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
    const desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<[^>]*>/g, '')
      ?.replace(/&lt;[^&]*&gt;/g, '')
      ?.replace(/&amp;/g, '&')
      ?.replace(/Source :.*$/, '')
      ?.trim() || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map(m => m[1]);
    const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() || link;

    if (!title) continue;

    let type: FeedItem['type'] = 'news';
    const catStr = categories.join(' ').toLowerCase();
    const titleLower = title.toLowerCase();
    const descLower = desc.toLowerCase();
    const combinedText = `${catStr} ${titleLower} ${descLower}`;
    if (combinedText.match(/legislat|regulation|directive|law|adopt|enact|entered into force/)) type = 'legislation';
    else if (combinedText.match(/proposal|draft|recommend|consult|initiative|strategy|roadmap|action plan/)) type = 'proposal';
    else if (combinedText.match(/statistic|eurostat|data|survey|report|figure|percent|growth|rate|index/)) type = 'statistic';

    items.push({
      id: guid,
      title,
      description: desc.slice(0, 300),
      date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      type,
      relevanceScore: 0.8,
      sourceUrl: link,
      summary: '',
      source: sourceName,
    });
  }

  return items;
}

async function fetchRawItems(): Promise<FeedItem[]> {
  const [epResult, ecResult] = await Promise.allSettled([
    fetch(EP_RSS_URL, { next: { revalidate: 1800 } }).then(r => {
      if (!r.ok) throw new Error(`EP RSS: ${r.status}`);
      return r.text();
    }),
    fetch(EC_RSS_URL, { next: { revalidate: 1800 } }).then(r => {
      if (!r.ok) throw new Error(`EC RSS: ${r.status}`);
      return r.text();
    }),
  ]);

  const epItems = epResult.status === 'fulfilled'
    ? parseRSS(epResult.value, 'European Parliament')
    : [];
  const ecItems = ecResult.status === 'fulfilled'
    ? parseRSS(ecResult.value, 'European Commission')
    : [];

  return [...epItems, ...ecItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}

async function translateAndScore(
  items: FeedItem[],
  country: string,
  age: number,
  language: string,
  profileContext: string,
): Promise<FeedItem[]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || items.length === 0) return items;

  // Clone items to avoid mutating originals
  const result = items.map(item => ({ ...item }));

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
- SUMMARY: One sentence in ${language} explaining what this means for them personally

CRITICAL: You MUST include all 4 fields separated by | for EVERY line. Do not skip DESC.`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
    });

    if (response.ok) {
      const data = await response.json();
      const lines = (data.choices?.[0]?.message?.content || '')
        .split('\n')
        .filter((l: string) => l.includes('|'));

      for (let i = 0; i < Math.min(lines.length, result.length); i++) {
        const line = lines[i].replace(/^\d+\.\s*/, '');
        const parts = line.split('|');
        if (parts.length < 2) continue;

        const scoreStr = parts[0].trim();
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) result[i].relevanceScore = Math.min(Math.max(score, 0), 1);

        if (isEnglish || parts.length === 2) {
          const summary = parts.slice(1).join('|').trim();
          if (summary) result[i].summary = summary;
        } else if (parts.length === 3) {
          const translatedTitle = parts[1]?.trim();
          const summary = parts[2]?.trim();
          if (translatedTitle) result[i].title = translatedTitle;
          if (summary) result[i].summary = summary;
        } else {
          // SCORE|TITLE|DESC|SUMMARY (4+ parts)
          const translatedTitle = parts[1]?.trim();
          const translatedDesc = parts[2]?.trim();
          const summary = parts.slice(3).join('|').trim();
          if (translatedTitle) result[i].title = translatedTitle;
          if (translatedDesc) result[i].description = translatedDesc;
          if (summary) result[i].summary = summary;
        }
      }
    }
  } catch (aiErr) {
    console.error('Mistral scoring failed (using defaults):', aiErr);
  }

  result.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return result;
}

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') || '';
  const age = parseInt(req.nextUrl.searchParams.get('age') || '30');
  const quick = req.nextUrl.searchParams.get('quick') === 'true';
  const employmentStatus = req.nextUrl.searchParams.get('employmentStatus') || '';
  const industry = req.nextUrl.searchParams.get('industry') || '';
  const isParent = req.nextUrl.searchParams.get('isParent') === 'true';
  const housingStatus = req.nextUrl.searchParams.get('housingStatus') || '';
  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);

  const cacheKey = `${country}:${age}`;

  try {
    // Check cache first
    const cached = feedCache.get(cacheKey);
    const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);

    // Quick mode: serve cache if available, otherwise fetch raw (no Mistral)
    if (quick) {
      if (isFresh) {
        return NextResponse.json({ success: true, data: cached.items, source: 'cached' });
      }
      // No cache yet - fetch raw RSS items without translation (fast)
      const rawItems = await fetchRawItems();
      if (rawItems.length === 0) throw new Error('No items parsed');
      return NextResponse.json({ success: true, data: rawItems, source: 'live-raw' });
    }

    // Full mode: serve cache if fresh
    if (isFresh) {
      return NextResponse.json({ success: true, data: cached.items, source: 'cached' });
    }

    // Fetch fresh RSS items
    const rawItems = await fetchRawItems();
    if (rawItems.length === 0) throw new Error('No items parsed from any source');

    // Build profile context
    const profileParts: string[] = [`a ${age}-year-old in ${countryName}`];
    if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);
    if (industry) profileParts.push(`industry: ${industry}`);
    if (isParent) profileParts.push('is a parent');
    if (housingStatus) profileParts.push(`housing: ${housingStatus}`);
    const profileContext = profileParts.join(', ');

    // Translate and score with Mistral
    const processedItems = await translateAndScore(rawItems, country, age, language, profileContext);

    // Cache the result
    feedCache.set(cacheKey, { items: processedItems, timestamp: Date.now() });

    return NextResponse.json({ success: true, data: processedItems, source: 'live' });
  } catch (error) {
    console.error('EU feed fetch failed:', error);
    // Try serving stale cache on error
    const stale = feedCache.get(cacheKey);
    if (stale) {
      return NextResponse.json({ success: true, data: stale.items, source: 'stale-cache' });
    }
    return NextResponse.json({ success: false, data: [], source: 'error' });
  }
}
