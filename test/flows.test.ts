import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchWithEUComparison, fetchRealEurostatData } from '../src/services/eurostat';

async function withFetch<T>(handler: (url: string) => Response, fn: () => Promise<T>): Promise<T> {
  const originalFetch = global.fetch;
  const originalError = console.error;
  global.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
  }
}

test('Eurostat outage is reported as partial so stats/compare do not label estimates as live', async () => {
  await withFetch(() => { throw new Error('network down'); }, async () => {
    const result = await fetchWithEUComparison('PL', ['unemployment', 'inflation']);
    assert.equal(result.partial, true);
    // Estimates are identical for every geo, which is why they must never be presented as Eurostat data.
    assert.deepEqual(result.country.map((r) => r.value), result.eu.map((r) => r.value));
    assert.ok(result.country.every((r) => r.source === 'Estimate'));

    const de = await fetchRealEurostatData('DE', ['unemployment']);
    assert.equal(de.data[0].source, 'Estimate');
  });
});

test('Eurostat success is reported as not partial', async () => {
  const jsonstat = {
    dimension: { time: { category: { index: { '2025-08': 0 } } } },
    value: { '0': 5.4 },
  };
  await withFetch(() => new Response(JSON.stringify(jsonstat), { status: 200 }), async () => {
    const result = await fetchWithEUComparison('PL', ['unemployment']);
    assert.equal(result.partial, false);
    assert.equal(result.country[0].value, 5.4);
    assert.equal(result.country[0].source, 'Eurostat');
  });
});

test('page-level ?demo= override is forwarded to API calls (README "fallback continuity" flow)', async () => {
  const { withClientDemoParam } = await import('../src/lib/demo-mode');
  const g = globalThis as unknown as { window?: { location: { href: string } } };
  const previousWindow = g.window;
  const previousEnv = process.env.NEXT_PUBLIC_DEMO_MODE;
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
  try {
    g.window = { location: { href: 'http://localhost:3000/rankings?demo=1' } };
    assert.equal(withClientDemoParam('/api/rankings'), '/api/rankings?demo=snapshot');
    assert.equal(withClientDemoParam('/api/eu-feed?country=PL&age=30'), '/api/eu-feed?country=PL&age=30&demo=snapshot');

    g.window = { location: { href: 'http://localhost:3000/rankings' } };
    assert.equal(withClientDemoParam('/api/rankings'), '/api/rankings');
  } finally {
    if (previousWindow === undefined) delete g.window;
    else g.window = previousWindow;
    if (previousEnv !== undefined) process.env.NEXT_PUBLIC_DEMO_MODE = previousEnv;
  }
});
