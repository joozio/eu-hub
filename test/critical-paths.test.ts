import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { asAge, asCountryCode } from '../src/lib/api-guard';
import { parseRssItems } from '../src/lib/rss';
import { POST as postChat } from '../src/app/api/chat/route';
import { POST as postChatStream } from '../src/app/api/chat/stream/route';
import { POST as postPersonalizedBrief } from '../src/app/api/personalized-brief/route';
import { GET as getFeed } from '../src/app/api/eu-feed/route';
import { GET as getRankings } from '../src/app/api/rankings/route';

// Fake key so routes take their Mistral branch; fetch is always mocked.
const FAKE_KEY = 'test-key-not-real-0123456789';

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

async function withMocks<T>(handler: Handler, key: string | null, fn: (calls: Array<{ url: string; init?: RequestInit }>) => Promise<T>): Promise<T> {
  const originalFetch = global.fetch;
  const previousKey = process.env.MISTRAL_API_KEY;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  if (key) process.env.MISTRAL_API_KEY = key;
  else delete process.env.MISTRAL_API_KEY;
  try {
    return await fn(calls);
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = previousKey;
  }
}

function mistralJson(content: string): Response {
  return new Response(JSON.stringify({ model: 'mistral-small-mock', choices: [{ message: { content } }] }), { status: 200 });
}

function jsonPost(url: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  });
}

function rssItem(title: string, link: string, pubDate: string): string {
  return `<item><title>${title}</title><link>${link}</link><description>About ${title}</description><pubDate>${pubDate}</pubDate><guid>${link}</guid></item>`;
}

// ---------- Input normalization (every route depends on it) ----------

test('asAge and asCountryCode normalize hostile input', () => {
  assert.equal(asAge('abc'), 30);
  assert.equal(asAge(5), 13);
  assert.equal(asAge(1e9), 100);
  assert.equal(asAge('42.9'), 42);
  assert.equal(asCountryCode(' pl '), 'PL');
  assert.equal(asCountryCode('EU27_2020'), 'EU27_2020');
  assert.equal(asCountryCode('PL; DROP'), '');
  assert.equal(asCountryCode(42), '');
});

// ---------- Ask EU ----------

test('POST /api/chat sends profile context and language to Mistral and returns the answer', async () => {
  await withMocks(() => mistralJson('The AI Act applies from August 2025.'), FAKE_KEY, async (calls) => {
    const res = await postChat(jsonPost('http://localhost:3000/api/chat', {
      question: '  What is the AI Act?  ',
      country: 'pl',
      age: 27,
      employmentStatus: 'employed',
      industry: 'tech',
      isParent: true,
    }, '192.0.2.10'));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.answer, 'The AI Act applies from August 2025.');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.mistral.ai/v1/chat/completions');
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${FAKE_KEY}`);

    const sent = JSON.parse(String(calls[0].init?.body));
    assert.match(sent.messages[0].content, /lives in Poland, 27 years old, employment: employed, industry: tech, is a parent/);
    assert.match(sent.messages[0].content, /Respond entirely in Polish/);
    assert.equal(sent.messages[1].content, 'What is the AI Act?');
  });
});

test('POST /api/chat rejects missing question or invalid country without calling Mistral', async () => {
  await withMocks(() => mistralJson('nope'), FAKE_KEY, async (calls) => {
    const noQuestion = await postChat(jsonPost('http://localhost:3000/api/chat', { question: '   ', country: 'PL' }, '192.0.2.11'));
    const badCountry = await postChat(jsonPost('http://localhost:3000/api/chat', { question: 'Hi', country: 'Atlantis' }, '192.0.2.11'));
    const notJson = await postChat(new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST', body: '{broken', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.11' },
    }));
    assert.equal(noQuestion.status, 400);
    assert.equal(badCountry.status, 400);
    assert.equal(notJson.status, 400);
    assert.equal(calls.length, 0);
  });
});

test('POST /api/chat/stream re-assembles SSE lines split across upstream chunks', async () => {
  const encoder = new TextEncoder();
  const upstreamChunks = [
    'data: {"choices":[{"delta":{"content":"Hel',
    'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n',
    '\ndata: [DONE]\n\n',
  ];
  const upstream = () => new Response(new ReadableStream({
    start(controller) {
      for (const chunk of upstreamChunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } });

  await withMocks(upstream, FAKE_KEY, async () => {
    const res = await postChatStream(jsonPost('http://localhost:3000/api/chat/stream', {
      question: 'Hi', country: 'DE', age: 30,
    }, '192.0.2.12'));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');

    const text = await res.text();
    const events = text.split('\n\n').filter(Boolean).map((e) => e.replace(/^data: /, ''));
    assert.equal(events[events.length - 1], '[DONE]');
    const content = events.slice(0, -1).map((e) => JSON.parse(e).content).join('');
    assert.equal(content, 'Hello world');
  });
});

test('Ask EU routes are rate limited per client with Retry-After', async () => {
  await withMocks(() => mistralJson('x'), null, async () => {
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await postChat(jsonPost('http://localhost:3000/api/chat', { question: 'Hi', country: 'PL' }, '192.0.2.13'));
    }
    assert.equal(last?.status, 429);
    assert.ok(Number(last?.headers.get('retry-after')) >= 1);

    const otherClient = await postChat(jsonPost('http://localhost:3000/api/chat', { question: 'Hi', country: 'PL' }, '192.0.2.14'));
    assert.notEqual(otherClient.status, 429);
  });
});

// ---------- Feed ----------

test('parseRssItems keeps every item and does not throw on an unparseable pubDate', () => {
  const xml = `<rss><channel>${rssItem('Good item', 'https://example.eu/1', 'Sun, 01 Mar 2026 10:00:00 GMT')}${rssItem('Odd date', 'https://example.eu/2', 'sometime last week')}</channel></rss>`;
  const items = parseRssItems(xml, 'European Parliament');
  assert.equal(items.length, 2);
  assert.equal(items[0].date, '2026-03-01');
  assert.match(items[1].date, /^\d{4}-\d{2}-\d{2}$/);
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
    const res = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=IE&age=30', {
      headers: { 'x-forwarded-for': '192.0.2.20' },
    }));
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

test('GET /api/eu-feed still parses scores when Mistral numbers its lines', async () => {
  const epXml = `<rss><channel>${rssItem('First', 'https://www.europarl.europa.eu/news/5', 'Mon, 02 Mar 2026 09:00:00 GMT')}${rssItem('Second', 'https://www.europarl.europa.eu/news/6', 'Sun, 01 Mar 2026 09:00:00 GMT')}</channel></rss>`;
  const handler: Handler = (url) => {
    if (url.includes('mistral')) return mistralJson('1. 0.35|First summary\n2. 0.75|Second summary');
    return new Response(url.includes('europarl') ? epXml : '<rss></rss>', { status: 200 });
  };
  await withMocks(handler, FAKE_KEY, async () => {
    const res = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=MT&age=30', {
      headers: { 'x-forwarded-for': '192.0.2.23' },
    }));
    const body = await res.json();
    assert.deepEqual(body.data.map((i: { title: string; relevanceScore: number }) => [i.title, i.relevanceScore]), [['Second', 0.75], ['First', 0.35]]);
  });
});

test('GET /api/eu-feed survives a malformed pubDate in an upstream feed', async () => {
  const epXml = `<rss><channel>${rssItem('Valid', 'https://www.europarl.europa.eu/news/3', 'Mon, 02 Mar 2026 09:00:00 GMT')}${rssItem('Broken date', 'https://www.europarl.europa.eu/news/4', 'not-a-date')}</channel></rss>`;
  const ecXml = `<rss><channel>${rssItem('Commission item', 'https://ec.europa.eu/commission/presscorner/detail/en/ip_1', 'Tue, 03 Mar 2026 09:00:00 GMT')}</channel></rss>`;
  const handler: Handler = (url) => new Response(url.includes('europarl') ? epXml : ecXml, { status: 200 });

  await withMocks(handler, null, async () => {
    const res = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=FR&age=40', {
      headers: { 'x-forwarded-for': '192.0.2.21' },
    }));
    const body = await res.json();
    assert.equal(body.success, true, 'one bad date must not take down the whole feed');
    assert.equal(body.data.length, 3);
  });
});

test('GET /api/eu-feed rejects an invalid country and returns error contract when all sources fail', async () => {
  await withMocks(() => { throw new Error('network down'); }, null, async () => {
    const bad = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=XYZ', { headers: { 'x-forwarded-for': '192.0.2.22' } }));
    assert.equal(bad.status, 400);

    const originalError = console.error;
    console.error = () => {};
    try {
      const down = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=DK&age=55', { headers: { 'x-forwarded-for': '192.0.2.22' } }));
      const body = await down.json();
      assert.equal(body.success, false);
      assert.deepEqual(body.data, []);

      const hybrid = await getFeed(new NextRequest('http://localhost:3000/api/eu-feed?country=DK&age=55&demo=hybrid', { headers: { 'x-forwarded-for': '192.0.2.22' } }));
      const hybridBody = await hybrid.json();
      assert.equal(hybridBody.success, true);
      assert.equal(hybridBody.source, 'snapshot-fallback');
      assert.ok(hybridBody.data.length > 0);
    } finally {
      console.error = originalError;
    }
  });
});

// ---------- Impact brief ----------

test('POST /api/personalized-brief returns AI sections when Mistral answers in the expected shape', async () => {
  const content = JSON.stringify({
    brief: 'Your week in the EU.',
    sections: [
      { title: 'Top opportunities', items: ['Youth Guarantee offers'] },
      { title: 'Key risks', items: ['Energy prices'] },
      { title: 'One action this week', items: ['Check your eligibility'] },
    ],
    citations: [{ label: 'Eurostat', url: 'https://ec.europa.eu/eurostat', source: 'Eurostat' }],
  });
  await withMocks(() => mistralJson(content), FAKE_KEY, async (calls) => {
    const res = await postPersonalizedBrief(jsonPost('http://localhost:3000/api/personalized-brief', {
      profile: { country: 'PL', age: 24, priorityThemes: ['jobs', 'bogus'] },
      topStats: [{ indicator: 'unemployment', value: 3.1, unit: '%', label: 'Unemployment Rate' }],
      topFeedItems: [{ title: 'EU jobs package', sourceUrl: 'https://ec.europa.eu/x' }],
    }, '192.0.2.30'));
    const body = await res.json();
    assert.equal(body.mode, 'ai');
    assert.equal(body.sections.length, 3);
    assert.deepEqual(body.sections[0], { title: 'Top opportunities', items: ['Youth Guarantee offers'] });
    assert.equal(body.citations[0].url, 'https://ec.europa.eu/eurostat');

    const sent = JSON.parse(JSON.parse(String(calls[0].init?.body)).messages[1].content);
    assert.deepEqual(sent.profile.priorityThemes, ['jobs'], 'unknown themes are dropped');
  });
});

test('POST /api/personalized-brief falls back deterministically when Mistral fails or returns junk', async () => {
  for (const handler of [
    () => new Response('boom', { status: 500 }),
    () => mistralJson('not json at all'),
    () => { throw new Error('timeout'); },
  ] as Handler[]) {
    await withMocks(handler, FAKE_KEY, async () => {
      const res = await postPersonalizedBrief(jsonPost('http://localhost:3000/api/personalized-brief', {
        profile: { country: 'PL', age: 30, priorityThemes: ['climate'] },
        topStats: [],
        topFeedItems: [],
      }, '192.0.2.31'));
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.mode, 'fallback');
      assert.equal(body.sections.length, 3);
      assert.ok(body.sections[2].items.some((item: string) => item.includes('energy transition')));
    });
  }
});

// ---------- Rankings ----------

test('GET /api/rankings does not cache an empty result when Eurostat is down', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await withMocks(() => { throw new Error('eurostat unreachable'); }, null, async () => {
      const off = await getRankings(new NextRequest('http://localhost:3000/api/rankings', { headers: { 'x-forwarded-for': '192.0.2.40' } }));
      assert.equal(off.status, 500, 'outage must surface as an error, not an empty "live" ranking');

      const hybrid = await getRankings(new NextRequest('http://localhost:3000/api/rankings?demo=hybrid', { headers: { 'x-forwarded-for': '192.0.2.40' } }));
      const hybridBody = await hybrid.json();
      assert.equal(hybridBody.meta.freshness, 'snapshot');
      assert.ok(hybridBody.indicators.length > 0);
    });

    // Once Eurostat recovers, the next request must fetch live data instead of an empty cached copy.
    const jsonstat = {
      id: ['geo', 'time'],
      size: [2, 1],
      dimension: {
        geo: { category: { index: { PL: 0, EU27_2020: 1 } } },
        time: { category: { index: { '2025': 0 } } },
      },
      value: { '0': 3.2, '1': 5.9 },
    };
    await withMocks(() => new Response(JSON.stringify(jsonstat), { status: 200 }), null, async () => {
      const res = await getRankings(new NextRequest('http://localhost:3000/api/rankings', { headers: { 'x-forwarded-for': '192.0.2.40' } }));
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.meta.freshness, 'live');
      assert.ok(body.indicators.length > 0);
      const pl = body.indicators[0].entries.find((e: { country: string }) => e.country === 'PL');
      assert.equal(pl.value, 3.2);
      assert.equal(pl.rank, 1);
    });
  } finally {
    console.error = originalError;
  }
});
