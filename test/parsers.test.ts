import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRssItems } from '../src/lib/rss';
import { parseMultiGeoResponse } from '../src/services/eurostat-rankings';

test('parseRssItems extracts basic fields and infers type', () => {
  const xml = `
    <rss><channel>
      <item>
        <title>Press release - New Directive on platform work</title>
        <link>https://example.eu/directive</link>
        <description>Directive text and adoption timeline.</description>
        <pubDate>Sun, 01 Mar 2026 10:00:00 GMT</pubDate>
        <category>Legislation</category>
        <guid>abc-1</guid>
      </item>
    </channel></rss>
  `;

  const items = parseRssItems(xml, 'European Parliament');
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'abc-1');
  assert.equal(items[0].type, 'legislation');
  assert.equal(items[0].source, 'European Parliament');
});

test('parseMultiGeoResponse returns latest values per geo', () => {
  const jsonstat = {
    id: ['geo', 'time'],
    size: [2, 2],
    dimension: {
      geo: {
        category: {
          index: { PL: 0, FR: 1 },
        },
      },
      time: {
        category: {
          index: { '2024': 0, '2025': 1 },
        },
      },
    },
    value: {
      '0': 5.2,
      '1': 4.8,
      '2': 7.1,
      '3': 6.9,
    },
  };

  const parsed = parseMultiGeoResponse(jsonstat, ['PL', 'FR']);
  assert.equal(parsed.get('PL')?.value, 4.8);
  assert.equal(parsed.get('PL')?.period, '2025');
  assert.equal(parsed.get('FR')?.value, 6.9);
});
