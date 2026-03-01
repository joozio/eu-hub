import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreFeedLikeItem, getIndicatorPriorityWeight } from '../src/lib/personalization';

test('priority themes increase feed relevance score', () => {
  const base = scoreFeedLikeItem(
    { country: 'PL', age: 30 },
    { title: 'AI policy update', description: 'Digital policy and data rules in the EU', relevanceScore: 0.5 }
  );
  const personalized = scoreFeedLikeItem(
    { country: 'PL', age: 30, priorityThemes: ['digital'] },
    { title: 'AI policy update', description: 'Digital policy and data rules in the EU', relevanceScore: 0.5 }
  );

  assert.ok(personalized.score > base.score);
  assert.ok(personalized.reasons.length > 0);
});

test('indicator priority weight increases when theme matches', () => {
  const neutral = getIndicatorPriorityWeight('unemployment', { country: 'PL', age: 30 });
  const focused = getIndicatorPriorityWeight('unemployment', { country: 'PL', age: 30, priorityThemes: ['jobs'] });
  assert.ok(focused > neutral);
});
