/**
 * Bulk Eurostat fetcher for country rankings.
 * Uses multi-geo params to fetch all 27 EU countries + EU average in a single API call per indicator.
 */

import { INDICATORS, IndicatorConfig, getEurostatGeo } from './eurostat';
import { EU_COUNTRIES } from '@/lib/countries';
import { withSourceProbe } from '@/lib/source-registry';

// 8 selected indicators for rankings (wide variance, easy comprehension)
const RANKING_INDICATOR_IDS = [
  'unemployment', 'minimum_wages', 'gdp_growth',
  'median_income', 'poverty_risk', 'housing_cost_burden',
  'renewable_energy', 'life_expectancy',
];

// Which indicators are "higher is better"
const HIGHER_IS_BETTER: Record<string, boolean> = {
  unemployment: false,
  minimum_wages: true,
  gdp_growth: true,
  median_income: true,
  poverty_risk: false,
  housing_cost_burden: false,
  renewable_energy: true,
  life_expectancy: true,
};

export interface RankingEntry {
  country: string;
  countryName: string;
  value: number | null;
  rank: number | null;
  period: string;
}

export interface IndicatorRanking {
  indicatorId: string;
  label: string;
  unit: string;
  category: 'economy' | 'living' | 'society';
  higherIsBetter: boolean;
  euAverage: number | null;
  euPeriod: string;
  entries: RankingEntry[];
  countriesWithData: number;
}

export interface RankingsData {
  indicators: IndicatorRanking[];
  fetchedAt: string;
}

const ALL_GEO_CODES = EU_COUNTRIES.map(c => c.code);
const COUNTRY_NAME_MAP: Record<string, string> = Object.fromEntries(
  EU_COUNTRIES.map(c => [c.code, c.name])
);

/**
 * Build a bulk URL with multiple &geo= params.
 * Takes the existing single-geo buildUrl, extracts the base, and appends all geo codes.
 */
function buildBulkUrl(config: IndicatorConfig, geoCodes: string[]): string {
  // Get URL with a placeholder geo
  const singleUrl = config.buildUrl('__PLACEHOLDER__');
  // Remove the placeholder geo param
  const withoutGeo = singleUrl.replace(/[&?]geo=__PLACEHOLDER__/, '');
  // Add all geo params
  const geoParams = geoCodes.map(code => `&geo=${getEurostatGeo(code)}`).join('');
  // Find where to insert (after the first ? or after format param)
  if (withoutGeo.includes('?')) {
    return withoutGeo + geoParams;
  }
  return withoutGeo + '?' + geoParams.slice(1); // remove leading &
}

/**
 * Parse a multi-geo Eurostat JSON-stat response.
 * Returns a map of country code -> { value, period } for the latest available data point.
 */
export function parseMultiGeoResponse(
  data: Record<string, unknown>,
  geoCodes: string[]
): Map<string, { value: number; period: string }> {
  const result = new Map<string, { value: number; period: string }>();

  const dimensionObj = data.dimension as Record<string, Record<string, unknown>> | undefined;
  const idArray = data.id as string[] | undefined;
  const sizeArray = data.size as number[] | undefined;
  const values = data.value as Record<string, number> | undefined;

  if (!dimensionObj || !idArray || !sizeArray || !values) return result;

  // Find geo and time dimension indices
  const geoDimIdx = idArray.indexOf('geo');
  const timeDimIdx = idArray.indexOf('time');
  if (geoDimIdx === -1 || timeDimIdx === -1) return result;

  // Get dimension category indices
  const geoCat = (dimensionObj.geo?.category as Record<string, unknown>)?.index as Record<string, number> | undefined;
  const timeCat = (dimensionObj.time?.category as Record<string, unknown>)?.index as Record<string, number> | undefined;

  if (!geoCat || !timeCat) return result;

  // Sort time periods descending (latest first)
  const timePeriods = Object.entries(timeCat).sort(([, a], [, b]) => b - a);

  // Build reverse geo map (Eurostat code -> ISO code)
  const eurostatToIso = new Map<string, string>();
  for (const code of geoCodes) {
    eurostatToIso.set(getEurostatGeo(code), code);
  }

  // For each geo code, find the latest value
  for (const [eurostatGeo, geoIdx] of Object.entries(geoCat)) {
    const isoCode = eurostatToIso.get(eurostatGeo) || eurostatGeo;

    for (const [period, timeIdx] of timePeriods) {
      // Calculate flat index using row-major order
      let flatIdx = 0;
      for (let d = 0; d < idArray.length; d++) {
        const dimIdx = d === geoDimIdx ? geoIdx : d === timeDimIdx ? timeIdx : 0;
        flatIdx = flatIdx * sizeArray[d] + dimIdx;
      }

      const val = values[String(flatIdx)];
      if (val !== undefined && val !== null) {
        result.set(isoCode, {
          value: Math.round(val * 100) / 100,
          period,
        });
        break; // Found latest value for this country
      }
    }
  }

  return result;
}

/**
 * Fetch a single indicator for all countries in one API call.
 */
async function fetchBulkIndicator(
  config: IndicatorConfig,
  geoCodes: string[]
): Promise<{
  countryData: Map<string, { value: number; period: string }>;
  euData: { value: number; period: string } | null;
}> {
  const allCodes = [...geoCodes, 'EU27_2020'];
  const url = buildBulkUrl(config, allCodes);

  const response = await withSourceProbe('eurostat', () => fetch(url, { next: { revalidate: 21600 } })); // 6 hours
  if (!response.ok) {
    throw new Error(`Eurostat API error for ${config.id}: ${response.status}`);
  }

  const data = await response.json();
  const parsed = parseMultiGeoResponse(data, allCodes);

  const euData = parsed.get('EU27_2020') || null;
  parsed.delete('EU27_2020');

  return { countryData: parsed, euData };
}

/**
 * Fetch all ranking indicators and assemble full rankings data.
 */
export async function fetchAllRankings(): Promise<RankingsData> {
  const configs = RANKING_INDICATOR_IDS
    .map(id => INDICATORS.find(i => i.id === id))
    .filter(Boolean) as IndicatorConfig[];

  const results = await Promise.allSettled(
    configs.map(config => fetchBulkIndicator(config, ALL_GEO_CODES))
  );

  const indicators: IndicatorRanking[] = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const result = results[i];
    const higherIsBetter = HIGHER_IS_BETTER[config.id] ?? true;

    if (result.status === 'rejected') {
      console.error(`Rankings: failed to fetch ${config.id}:`, result.reason);
      continue;
    }

    const { countryData, euData } = result.value;

    // Build entries for all 27 countries
    const entries: RankingEntry[] = ALL_GEO_CODES.map(code => {
      const data = countryData.get(code);
      return {
        country: code,
        countryName: COUNTRY_NAME_MAP[code] || code,
        value: data?.value ?? null,
        rank: null, // assigned below
        period: data?.period ?? '',
      };
    });

    // Sort: countries with data first, then by value
    const withData = entries.filter(e => e.value !== null);
    const withoutData = entries.filter(e => e.value === null);

    withData.sort((a, b) => {
      if (higherIsBetter) return (b.value as number) - (a.value as number);
      return (a.value as number) - (b.value as number);
    });

    // Assign ranks (rank 1 = best)
    withData.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    indicators.push({
      indicatorId: config.id,
      label: config.label,
      unit: config.unit,
      category: config.category,
      higherIsBetter,
      euAverage: euData?.value ?? null,
      euPeriod: euData?.period ?? '',
      entries: [...withData, ...withoutData],
      countriesWithData: withData.length,
    });
  }

  return {
    indicators,
    fetchedAt: new Date().toISOString(),
  };
}
