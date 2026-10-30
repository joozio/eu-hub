import { profile } from '@/lib/model-schema';
import { modelFetch, GuardError } from '@/lib/model-guard';
/**
 * EU Data Scraper using fetch + HTML parsing
 * Scrapes EUR-Lex and European Council websites for real legislation and policy updates
 */

import { FeedItem } from '@/types';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';

// EUR-Lex Official Journal - Latest legislation
const EUR_LEX_OJ_URL = 'https://eur-lex.europa.eu/oj/direct-access.html';

// European Council press releases
const COUNCIL_PRESS_URL = 'https://www.consilium.europa.eu/en/press/press-releases/';

interface ScrapeResult {
  success: boolean;
  items: FeedItem[];
  source: string;
}

export async function scrapeEURLex(): Promise<ScrapeResult> {
  try {
    const items: FeedItem[] = [];

    const res = await fetch(EUR_LEX_OJ_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EU-Hub/1.0)' },
    });
    if (!res.ok) throw new Error(`EUR-Lex fetch failed: ${res.status}`);
    const html = await res.text();

    // Extract legislation items from EUR-Lex OJ page
    const itemRegex = /<div[^>]*class="[^"]*oj-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    let i = 0;

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];
      const title = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
      const link = block.match(/<a[^>]*href="([^"]*)"[^>]*>/)?.[1] || '';
      const dateText = block.match(/class="[^"]*oj-date[^"]*"[^>]*>([\s\S]*?)<\//)?.[1]?.trim() || '';
      const description = block.match(/class="[^"]*oj-summary[^"]*"[^>]*>([\s\S]*?)<\//)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      if (title && link) {
        const parsedDate = dateText ? new Date(dateText) : new Date();
        items.push({
          id: `eurlex-${i}`,
          title: title.replace(/^\d+\/\s*/, ''),
          description: description.slice(0, 300),
          date: isNaN(parsedDate.getTime()) ? new Date().toISOString().split('T')[0] : parsedDate.toISOString().split('T')[0],
          type: 'legislation' as const,
          relevanceScore: 0.9,
          sourceUrl: link.startsWith('http') ? link : `https://eur-lex.europa.eu${link}`,
          summary: '',
          source: 'EUR-Lex',
        });
        i++;
      }
    }

    return {
      success: true,
      items: items.slice(0, 10),
      source: 'eurlex',
    };
  } catch (error) {
    if (error instanceof GuardError) throw error;
    console.error('EUR-Lex scraping failed:', error);
    return {
      success: false,
      items: [],
      source: 'eurlex',
    };
  }
}

export async function scrapeCouncilPress(): Promise<ScrapeResult> {
  try {
    const items: FeedItem[] = [];

    const res = await fetch(COUNCIL_PRESS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EU-Hub/1.0)' },
    });
    if (!res.ok) throw new Error(`Council fetch failed: ${res.status}`);
    const html = await res.text();

    // Extract press releases from European Council
    const articleRegex = /<article[^>]*class="[^"]*press-release[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    let match;
    let i = 0;

    while ((match = articleRegex.exec(html)) !== null) {
      const block = match[1];
      const title = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
      const link = block.match(/<a[^>]*href="([^"]*)"[^>]*>/)?.[1] || '';
      const dateText = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>/)?.[1] || '';
      const description = block.match(/class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\//)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

      if (title && link) {
        const type = title.toLowerCase().includes('conclusion')
          ? 'legislation' as const
          : title.toLowerCase().includes('proposal')
            ? 'proposal' as const
            : 'news' as const;

        const parsedDate = dateText ? new Date(dateText) : new Date();
        items.push({
          id: `council-${i}`,
          title,
          description: description.slice(0, 300),
          date: isNaN(parsedDate.getTime()) ? new Date().toISOString().split('T')[0] : parsedDate.toISOString().split('T')[0],
          type,
          relevanceScore: 0.85,
          sourceUrl: link.startsWith('http') ? link : `https://www.consilium.europa.eu${link}`,
          summary: '',
          source: 'European Council',
        });
        i++;
      }
    }

    return {
      success: true,
      items: items.slice(0, 10),
      source: 'council',
    };
  } catch (error) {
    if (error instanceof GuardError) throw error;
    console.error('Council scraping failed:', error);
    return {
      success: false,
      items: [],
      source: 'council',
    };
  }
}

export async function scrapeAllEUData(country: string, age: number): Promise<{ success: boolean; data: FeedItem[] }> {
  profile({ country, age });
  try {
    const [eurlexResult, councilResult] = await Promise.allSettled([
      scrapeEURLex(),
      scrapeCouncilPress(),
    ]);

    const allItems: FeedItem[] = [];

    if (eurlexResult.status === 'fulfilled' && eurlexResult.value.success) {
      allItems.push(...eurlexResult.value.items);
    }

    if (councilResult.status === 'fulfilled' && councilResult.value.success) {
      allItems.push(...councilResult.value.items);
    }

    // Sort by date (newest first)
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Use Mistral to score relevance and generate summaries
    const apiKey = process.env.MISTRAL_API_KEY;
    const countryName = COUNTRY_NAMES[country] || country;
    const language = getLangEnglish(country);

    if (apiKey && allItems.length > 0) {
      try {
        const response = await modelFetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{
              role: 'system',
              content: `You score EU legislation and policy items for relevance to a ${age}-year-old in ${countryName}.

IMPORTANT: Respond entirely in ${language}.

For each item, output exactly one line: SCORE|SUMMARY
- SCORE: 0.0-1.0 relevance (higher = more relevant to this person)
- SUMMARY: One sentence explaining what this means for them personally

Output ${allItems.length} lines, one per item, in order. No numbering, no extra text.`,
            }, {
              role: 'user',
              content: allItems.map((item, i) => `${i + 1}. "${item.title}" - ${item.description.slice(0, 150)}`).join('\n'),
            }],
            temperature: 0.2,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const lines = (data.choices?.[0]?.message?.content || '').split('\n').filter((l: string) => l.includes('|'));

          for (let i = 0; i < Math.min(lines.length, allItems.length); i++) {
            const line = lines[i].replace(/^\d+\.\s*/, '');
            const parts = line.split('|');
            if (parts.length === 2) {
              const score = parseFloat(parts[0].trim());
              if (!isNaN(score)) allItems[i].relevanceScore = Math.min(Math.max(score, 0), 1);
              allItems[i].summary = parts[1].trim();
            }
          }
        }
      } catch (aiErr) {
    if (aiErr instanceof GuardError) throw aiErr;
        console.error('Mistral scoring failed:', aiErr);
      }
    }

    return {
      success: true,
      data: allItems,
    };
  } catch (error) {
    if (error instanceof GuardError) throw error;
    console.error('EU data scraping failed:', error);
    return {
      success: false,
      data: [],
    };
  }
}
