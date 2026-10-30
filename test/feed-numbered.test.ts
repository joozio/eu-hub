import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { GET as getFeed } from '../src/app/api/eu-feed/route';

// Own file: the RSS loader caches upstream feeds per process (see feed-scoring.test.ts).

process.env.EU_HUB_BUDGET_DIR = mkdtempSync(join(tmpdir(), 'eu-hub-budget-'));

function rssItem(title: string, link: string, pubDate: string): string {
  return `<item><title>${title}</title><link>${link}</link><description>About ${title}</description><pubDate>${pubDate}</pubDate><guid>${link}</guid></item>`;
}

test('GET /api/eu-feed still parses scores when Mistral numbers its lines', async () => {
  const epXml = `<rss><channel>${rssItem('First', 'https://www.europarl.europa.eu/news/5', 'Mon, 02 Mar 2026 09:00:00 GMT')}${rssItem('Second', 'https://www.europarl.europa.eu/news/6', 'Sun, 01 Mar 2026 09:00:00 GMT')}</channel></rss>`;
  const originalFetch = global.fetch;
  const previousKey = process.env.MISTRAL_API_KEY;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('mistral')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: '1. 0.35|First summary\n2. 0.75|Second summary' } }] }), { status: 200 });
    }
    return new Response(url.includes('europarl') ? epXml : '<rss></rss>', { status: 200 });
  }) as typeof fetch;
  process.env.MISTRAL_API_KEY = 'test-key-not-real-0123456789';
  try {
    const res = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=MT&age=30', {
      headers: { 'x-real-ip': '192.0.2.23' },
    }));
    const body = await res.json();
    assert.deepEqual(body.data.map((i: { title: string; relevanceScore: number }) => [i.title, i.relevanceScore]), [['Second', 0.75], ['First', 0.35]]);
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = previousKey;
  }
});
