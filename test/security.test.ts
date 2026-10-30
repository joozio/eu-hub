import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

import { checkRateLimit } from '../src/lib/api-guard';
import { POST as postChat } from '../src/app/api/chat/route';
import { POST as postChatStream } from '../src/app/api/chat/stream/route';
import { POST as postPersonalizedBrief } from '../src/app/api/personalized-brief/route';
import { POST as postTranslateIndicators } from '../src/app/api/translate-indicators/route';
import { GET as getFeed } from '../src/app/api/eu-feed/route';

// Fake key used only so routes take their Mistral branch; fetch is always mocked.
const FAKE_KEY = 'test-key-not-real-0123456789';

interface CapturedCall {
  url: string;
  body: string;
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response): { calls: CapturedCall[]; restore: () => void } {
  const originalFetch = global.fetch;
  const calls: CapturedCall[] = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return handler(url, init);
  }) as typeof fetch;
  return { calls, restore: () => { global.fetch = originalFetch; } };
}

function withKey<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.MISTRAL_API_KEY;
  process.env.MISTRAL_API_KEY = FAKE_KEY;
  return fn().finally(() => {
    if (previous === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = previous;
  });
}

function mistralJson(content: string): Response {
  return new Response(JSON.stringify({ model: 'mock', choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonPost(url: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  });
}

test('rate limit cannot be bypassed by rotating a client-supplied X-Forwarded-For prefix', () => {
  // A reverse proxy appends the real peer address; everything before it is attacker-controlled.
  const results = [1, 2, 3].map((i) => {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      headers: { 'x-forwarded-for': `10.0.0.${i}, 198.51.100.7` },
    });
    return checkRateLimit(req, { key: 'test-xff-spoof', max: 2, windowMs: 60_000 });
  });

  assert.equal(results[0], null);
  assert.equal(results[1], null);
  assert.ok(results[2], 'third request from the same real peer must be limited');
  assert.equal(results[2]?.status, 429);
});

test('AI POST routes reject non-JSON content types (cross-site simple requests)', async () => {
  const mock = mockFetch(() => mistralJson('should not be called'));
  try {
    await withKey(async () => {
      const res = await postChat(new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ question: 'What is the AI Act?', country: 'PL', age: 30 }),
        headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': '198.51.100.20' },
      }));
      assert.equal(res.status, 415);

      const streamRes = await postChatStream(new NextRequest('http://localhost:3000/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify({ question: 'What is the AI Act?', country: 'PL', age: 30 }),
        headers: { 'content-type': 'text/plain', 'x-forwarded-for': '198.51.100.20' },
      }));
      assert.equal(streamRes.status, 415);
    });
    assert.equal(mock.calls.length, 0, 'Mistral must not be called for a cross-site simple request');
  } finally {
    mock.restore();
  }
});

test('personalized brief bounds attacker-sized fields before forwarding them to Mistral', async () => {
  const huge = 'A'.repeat(200_000);
  const mock = mockFetch(() => mistralJson('{}'));
  try {
    await withKey(async () => {
      const res = await postPersonalizedBrief(jsonPost('http://localhost:3000/api/personalized-brief', {
        profile: { country: huge, age: 30, employmentStatus: huge, industry: huge, housingStatus: huge },
        topStats: Array.from({ length: 8 }, () => ({ indicator: huge, value: 1, unit: huge, label: huge, source: huge })),
        topFeedItems: Array.from({ length: 6 }, () => ({ title: huge, summary: huge, sourceUrl: huge, source: huge })),
      }, '198.51.100.21'));
      assert.equal(res.status, 200);
    });
    assert.equal(mock.calls.length, 1);
    assert.ok(mock.calls[0].body.length < 20_000, `Mistral payload was ${mock.calls[0].body.length} chars`);
  } finally {
    mock.restore();
  }
});

test('translate-indicators caps the number and size of keys forwarded to Mistral', async () => {
  const labels: Record<string, string> = {};
  for (let i = 0; i < 5000; i++) labels[`key_${i}_${'x'.repeat(150)}`] = 'y'.repeat(200);
  labels.unemployment = 'Unemployment Rate';

  const mock = mockFetch(() => mistralJson('{"labels":{},"hints":{}}'));
  try {
    await withKey(async () => {
      const res = await postTranslateIndicators(jsonPost('http://localhost:3000/api/translate-indicators', {
        lang: 'de', labels, hints: labels,
      }, '198.51.100.22'));
      assert.equal(res.status, 200);
    });
    assert.equal(mock.calls.length, 1);
    assert.ok(mock.calls[0].body.length < 40_000, `Mistral payload was ${mock.calls[0].body.length} chars`);
    assert.ok(mock.calls[0].body.includes('Unemployment Rate'), 'legitimate indicator keys still forwarded');
  } finally {
    mock.restore();
  }
});

test('personalized brief never passes malformed or non-http LLM output to the dashboard', async () => {
  const llmOutput = JSON.stringify({
    brief: 'Brief',
    sections: [
      { title: 'Top opportunities', content: 'not an items array' },
      { title: 'Key risks', items: [{ text: 'object instead of string' }] },
    ],
    citations: [
      { label: 'Click me', url: 'javascript:alert(document.cookie)', source: 'x' },
      { label: 'Phish', url: 'data:text/html,<script>alert(1)</script>', source: 'x' },
    ],
  });
  const mock = mockFetch(() => mistralJson(llmOutput));
  try {
    await withKey(async () => {
      const res = await postPersonalizedBrief(jsonPost('http://localhost:3000/api/personalized-brief', {
        profile: { country: 'PL', age: 30 },
        topStats: [],
        topFeedItems: [],
      }, '198.51.100.23'));
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.sections) && body.sections.length > 0);
      for (const section of body.sections) {
        assert.equal(typeof section.title, 'string');
        assert.ok(Array.isArray(section.items), 'dashboard calls section.items.map');
        for (const item of section.items) assert.equal(typeof item, 'string');
      }
      assert.ok(body.citations.length > 0);
      for (const citation of body.citations) {
        assert.match(citation.url, /^https?:\/\//);
      }
    });
  } finally {
    mock.restore();
  }
});

test('Mistral upstream errors are not echoed in status or logs', async () => {
  const secretQuestion = 'my private question about my divorce settlement';
  const mock = mockFetch(() => new Response(JSON.stringify({
    detail: [{ type: 'string_too_long', loc: ['body', 'messages', 1, 'content'], input: secretQuestion }],
  }), { status: 401 }));
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  try {
    await withKey(async () => {
      const res = await postChat(jsonPost('http://localhost:3000/api/chat', {
        question: secretQuestion, country: 'PL', age: 30,
      }, '198.51.100.24'));
      assert.equal(res.status, 502, 'upstream auth status must not leak to clients');

      const streamRes = await postChatStream(jsonPost('http://localhost:3000/api/chat/stream', {
        question: secretQuestion, country: 'PL', age: 30,
      }, '198.51.100.24'));
      assert.equal(streamRes.status, 502);
    });
    assert.ok(!logged.some((line) => line.includes(secretQuestion)), 'user question must not reach server logs');
  } finally {
    console.error = originalError;
    mock.restore();
  }
});

test('feed cache is bounded so free-text profile fields cannot grow memory without limit', async () => {
  const rss = `<rss><channel><item><title>EU item</title><link>https://example.eu/a</link>
    <description>Desc</description><pubDate>Sun, 01 Mar 2026 10:00:00 GMT</pubDate><guid>g1</guid></item></channel></rss>`;
  const mock = mockFetch(() => new Response(rss, { status: 200 }));
  const previousKey = process.env.MISTRAL_API_KEY;
  delete process.env.MISTRAL_API_KEY;
  try {
    const call = async (i: number) => {
      const req = new NextRequest(`http://localhost:3000/api/eu-feed?country=PL&age=30&employmentStatus=e${i}`, {
        headers: { 'x-forwarded-for': `203.0.113.${i % 250}` },
      });
      return (await getFeed(req)).json();
    };

    const first = await call(0);
    assert.equal(first.source, 'live');
    for (let i = 1; i <= 600; i++) await call(i);
    const again = await call(0);
    assert.equal(again.source, 'live', 'oldest entry must have been evicted');
  } finally {
    if (previousKey !== undefined) process.env.MISTRAL_API_KEY = previousKey;
    mock.restore();
  }
});

test('installed Next.js is not in the range affected by the 2026 image optimizer and RSC advisories', () => {
  const pkg = JSON.parse(readFileSync(require.resolve('next/package.json'), 'utf8')) as { version: string };
  const [major, minor, patch] = pkg.version.split('.').map((n) => parseInt(n, 10));
  const atLeast = major > 16 || (major === 16 && (minor > 4 || (minor === 4 && patch >= 3)));
  assert.ok(atLeast, `next ${pkg.version} is below 16.4.3`);
});
