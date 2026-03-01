import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseRssItems } from '../src/lib/rss';
import { fetchAllRankings } from '../src/services/eurostat-rankings';
import { fetchWithEUComparison, fetchCountryIndicators } from '../src/services/eurostat';

const EP_RSS_URL = 'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml';
const EC_RSS_URL = 'https://ec.europa.eu/commission/presscorner/api/rss?language=en';

async function writeJson(path: string, payload: unknown) {
  await writeFile(path, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function refreshFeedSnapshot(dataDir: string) {
  const [epRes, ecRes] = await Promise.all([fetch(EP_RSS_URL), fetch(EC_RSS_URL)]);
  const [epXml, ecXml] = await Promise.all([epRes.text(), ecRes.text()]);

  const items = [
    ...parseRssItems(epXml, 'European Parliament'),
    ...parseRssItems(ecXml, 'European Commission'),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  await writeJson(resolve(dataDir, 'feed.json'), { data: items });
}

async function refreshRankingsSnapshot(dataDir: string) {
  const rankings = await fetchAllRankings();
  await writeJson(resolve(dataDir, 'rankings.json'), rankings);
}

async function refreshStatsSnapshot(dataDir: string) {
  const stats = await fetchWithEUComparison('PL', ['unemployment', 'median_income', 'life_expectancy']);
  await writeJson(resolve(dataDir, 'stats.json'), stats);
}

async function refreshCompareSnapshot(dataDir: string) {
  const indicatorIds = ['unemployment', 'gdp_growth', 'minimum_wages', 'inflation'];
  const [de, fr, pl] = await Promise.all([
    fetchCountryIndicators('DE', indicatorIds),
    fetchCountryIndicators('FR', indicatorIds),
    fetchCountryIndicators('PL', indicatorIds),
  ]);

  await writeJson(resolve(dataDir, 'compare.json'), { DE: de, FR: fr, PL: pl });
}

async function main() {
  const dataDir = resolve(process.cwd(), 'src/data/demo');
  await mkdir(dataDir, { recursive: true });

  console.log('Refreshing demo snapshots...');
  await Promise.all([
    refreshFeedSnapshot(dataDir),
    refreshRankingsSnapshot(dataDir),
    refreshStatsSnapshot(dataDir),
    refreshCompareSnapshot(dataDir),
  ]);
  console.log(`Done. Snapshots written to ${dataDir}`);
}

main().catch((error) => {
  console.error('Failed to refresh demo snapshots:', error);
  process.exit(1);
});
