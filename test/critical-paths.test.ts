import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { POST as postChat } from '../src/app/api/chat/route';
import { POST as postChatStream } from '../src/app/api/chat/stream/route';
import { GET as getRankings } from '../src/app/api/rankings/route';

// The model budget ledger lives on disk; keep it out of the working tree.
process.env.EU_HUB_BUDGET_DIR = mkdtempSync(join(tmpdir(), 'eu-hub-budget-'));

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
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
  });
}

// ---------- Ask EU ----------

test('POST /api/chat sends profile context and language to Mistral and returns the answer', async () => {
  await withMocks(() => mistralJson('The AI Act applies from August 2025.'), FAKE_KEY, async (calls) => {
    const res = await postChat(jsonPost('http://localhost:3000/api/chat', {
      question: 'What is the AI Act?',
      country: 'PL',
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
    const noQuestion = await postChat(jsonPost('http://localhost:3000/api/chat', { question: '   ', country: 'PL', age: 30 }, '192.0.2.11'));
    const badCountry = await postChat(jsonPost('http://localhost:3000/api/chat', { question: 'Hi', country: 'Atlantis', age: 30 }, '192.0.2.11'));
    const notJson = await postChat(new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST', body: '{broken', headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.11' },
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

// ---------- Rankings ----------

test('GET /api/rankings does not cache an empty result when Eurostat is down', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await withMocks(() => { throw new Error('eurostat unreachable'); }, null, async () => {
      const off = await getRankings();
      assert.equal(off.status, 500, 'outage must surface as an error, not an empty ranking');
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
      const res = await getRankings();
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.indicators.length > 0);
      const pl = body.indicators[0].entries.find((e: { country: string }) => e.country === 'PL');
      assert.equal(pl.value, 3.2);
      assert.equal(pl.rank, 1);
    });
  } finally {
    console.error = originalError;
  }
});
