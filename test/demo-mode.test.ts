import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { getRequestDemoMode, shouldFallbackToSnapshot, shouldUseSnapshot } from '../src/lib/demo-mode';

test('demo mode parser supports boolean query form', () => {
  const req = new NextRequest('http://localhost:3000/api/eu-feed?demo=1');
  assert.equal(getRequestDemoMode(req), 'snapshot');
  assert.equal(shouldUseSnapshot('snapshot'), true);
  assert.equal(shouldFallbackToSnapshot('hybrid'), true);
  assert.equal(shouldFallbackToSnapshot('off'), false);
});
