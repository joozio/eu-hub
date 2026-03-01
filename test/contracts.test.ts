import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { GET as getFeed } from '../src/app/api/eu-feed/route';
import { GET as getRankings } from '../src/app/api/rankings/route';
import { GET as getSourcesHealth } from '../src/app/api/health/sources/route';
import { POST as postPersonalizedBrief } from '../src/app/api/personalized-brief/route';

test('GET /api/eu-feed returns meta contract in snapshot mode', async () => {
  const req = new NextRequest('http://localhost:3000/api/eu-feed?country=PL&age=30&demo=1');
  const res = await getFeed(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.meta);
  assert.equal(typeof body.meta.generatedAt, 'string');
  assert.ok(['snapshot', 'cached', 'live', 'stale'].includes(body.meta.freshness));
  assert.ok(Array.isArray(body.meta.provenance));
});

test('GET /api/rankings returns meta contract in snapshot mode', async () => {
  const req = new NextRequest('http://localhost:3000/api/rankings?demo=1');
  const res = await getRankings(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.indicators));
  assert.ok(body.meta);
  assert.equal(body.meta.methodologyVersion, 'v2');
  assert.equal(typeof body.meta.coveragePct, 'number');
});

test('GET /api/health/sources returns source statuses', async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => new Response('ok', { status: 200 })) as typeof fetch;

  try {
    const req = new NextRequest('http://localhost:3000/api/health/sources');
    const res = await getSourcesHealth(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.sources));
    assert.ok(body.sources.length >= 4);
    assert.equal(typeof body.sources[0].sourceId, 'string');
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST /api/personalized-brief returns deterministic fallback structure', async () => {
  const req = new NextRequest('http://localhost:3000/api/personalized-brief?demo=1', {
    method: 'POST',
    body: JSON.stringify({
      profile: { country: 'PL', age: 30, priorityThemes: ['jobs'] },
      topStats: [{ indicator: 'unemployment', value: 3.8, unit: '%', label: 'Unemployment Rate' }],
      topFeedItems: [{ title: 'EU jobs package', sourceUrl: 'https://example.com' }],
    }),
    headers: { 'content-type': 'application/json' },
  });

  const res = await postPersonalizedBrief(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(typeof body.brief, 'string');
  assert.ok(Array.isArray(body.sections));
  assert.ok(Array.isArray(body.citations));
  assert.ok(['ai', 'fallback'].includes(body.mode));
});
