import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { GET as getFeed } from '../src/app/api/eu-feed/route';

// Own file: the RSS loader caches upstream feeds per process (see feed-scoring.test.ts).

function rssItem(title: string, link: string, pubDate: string): string {
  return `<item><title>${title}</title><link>${link}</link><description>About ${title}</description><pubDate>${pubDate}</pubDate><guid>${link}</guid></item>`;
}

test('GET /api/eu-feed survives a malformed pubDate in an upstream feed', async () => {
  const epXml = `<rss><channel>${rssItem('Valid', 'https://www.europarl.europa.eu/news/3', 'Mon, 02 Mar 2026 09:00:00 GMT')}${rssItem('Broken date', 'https://www.europarl.europa.eu/news/4', 'not-a-date')}</channel></rss>`;
  const ecXml = `<rss><channel>${rssItem('Commission item', 'https://ec.europa.eu/commission/presscorner/detail/en/ip_1', 'Tue, 03 Mar 2026 09:00:00 GMT')}</channel></rss>`;
  const originalFetch = global.fetch;
  const originalError = console.error;
  const previousKey = process.env.MISTRAL_API_KEY;
  global.fetch = (async (input: RequestInfo | URL) => new Response(String(input).includes('europarl') ? epXml : ecXml, { status: 200 })) as typeof fetch;
  console.error = () => {};
  delete process.env.MISTRAL_API_KEY;
  try {
    const res = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=FR&age=40', {
      headers: { 'x-real-ip': '192.0.2.21' },
    }));
    const body = await res.json();
    assert.equal(body.success, true, 'one bad date must not take down the whole feed');
    assert.equal(body.data.length, 3);
    const broken = body.data.find((i: { title: string }) => i.title === 'Broken date');
    assert.match(broken.date, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    if (previousKey !== undefined) process.env.MISTRAL_API_KEY = previousKey;
  }
});
