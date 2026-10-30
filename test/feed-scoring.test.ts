import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { GET as getFeed } from '../src/app/api/eu-feed/route';

// The RSS loader caches upstream feeds for 30 minutes per process, so each feed
// scenario lives in its own test file (node --test runs every file in its own process).

process.env.EU_HUB_BUDGET_DIR = mkdtempSync(join(tmpdir(), 'eu-hub-budget-'));

const FAKE_KEY = 'test-key-not-real-0123456789';

type Handler = (url: string) => Response;

async function withMocks<T>(handler: Handler, key: string | null, fn: () => Promise<T>): Promise<T> {
  const originalFetch = global.fetch;
  const previousKey = process.env.MISTRAL_API_KEY;
  global.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
  if (key) process.env.MISTRAL_API_KEY = key;
  else delete process.env.MISTRAL_API_KEY;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = previousKey;
  }
}

function mistralJson(content: string): Response {
  return new Response(JSON.stringify({ model: 'mistral-small-mock', choices: [{ message: { content } }] }), { status: 200 });
}

function rssItem(title: string, link: string, pubDate: string): string {
  return `<item><title>${title}</title><link>${link}</link><description>About ${title}</description><pubDate>${pubDate}</pubDate><guid>${link}</guid></item>`;
}

function feedRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/eu-feed?${query}`, { headers: { 'x-real-ip': '192.0.2.20' } });
}

test('GET /api/eu-feed rejects an invalid country and reports an error when all sources fail', async () => {
  await withMocks(() => { throw new Error('network down'); }, null, async () => {
    const bad = await getFeed(feedRequest('country=XYZ&age=30'));
    assert.equal(bad.status, 400);

    const down = await getFeed(feedRequest('country=DK&age=55'));
    assert.equal(down.status, 502);
    assert.ok((await down.json()).error);
  });
});

test('GET /api/eu-feed keeps serving one source when the other is down, and applies Mistral scores', async () => {
  const epXml = `<rss><channel>${rssItem('Parliament adopts directive', 'https://www.europarl.europa.eu/news/1', 'Mon, 02 Mar 2026 09:00:00 GMT')}${rssItem('Plenary agenda', 'https://www.europarl.europa.eu/news/2', 'Sun, 01 Mar 2026 09:00:00 GMT')}</channel></rss>`;
  const handler: Handler = (url) => {
    if (url.includes('europarl')) return new Response(epXml, { status: 200 });
    if (url.includes('presscorner')) return new Response('down', { status: 503 });
    if (url.includes('mistral')) return mistralJson('0.2|Low relevance summary\n0.9|High relevance summary');
    throw new Error(`unexpected fetch ${url}`);
  };

  await withMocks(handler, FAKE_KEY, async () => {
    const res = await getFeed(feedRequest('country=IE&age=30'));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.source, 'live');
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].title, 'Plenary agenda', 'higher Mistral score sorts first');
    assert.equal(body.data[0].summary, 'High relevance summary');
    assert.equal(body.data[0].relevanceScore, 0.9);
    assert.equal(body.data[1].relevanceScore, 0.2);
  });
});
