/**
 * Eurostat JSON API Integration
 * Free public API - no authentication required
 * Docs: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access
 */
import { withSourceProbe } from '@/lib/source-registry';

const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

// All indicators organized by category
export interface IndicatorConfig {
  id: string;
  code: string;
  label: string;
  unit: string;
  category: 'economy' | 'living' | 'society';
  buildUrl: (geo: string) => string;
  fallback: number;
}

export const INDICATORS: IndicatorConfig[] = [
  // ── Economy ──
  {
    id: 'inflation',
    code: 'prc_hicp_manr',
    label: 'Inflation (HICP)',
    unit: '%',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/prc_hicp_manr?format=JSON&lang=EN&geo=${geo}&coicop=CP00&sinceTimePeriod=2024`,
    fallback: 2.4,
  },
  {
    id: 'unemployment',
    code: 'une_rt_a',
    label: 'Unemployment Rate',
    unit: '%',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/une_rt_a?format=JSON&lang=EN&geo=${geo}&age=Y15-74&sex=T&unit=PC_ACT&sinceTimePeriod=2020`,
    fallback: 6.1,
  },
  {
    id: 'gdp_growth',
    code: 'namq_10_gdp',
    label: 'GDP Growth',
    unit: '%',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/namq_10_gdp?format=JSON&lang=EN&geo=${geo}&na_item=B1GQ&unit=CLV_PCH_PRE&s_adj=SCA&sinceTimePeriod=2024`,
    fallback: 0.9,
  },
  {
    id: 'minimum_wages',
    code: 'earn_mw_cur',
    label: 'Minimum Wage',
    unit: 'EUR/month',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/earn_mw_cur?format=JSON&lang=EN&geo=${geo}&currency=EUR&sinceTimePeriod=2020`,
    fallback: 1050,
  },
  {
    id: 'gov_debt',
    code: 'gov_10dd_edpt1',
    label: 'Government Debt',
    unit: '%',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/gov_10dd_edpt1?format=JSON&lang=EN&geo=${geo}&na_item=GD&sector=S13&unit=PC_GDP&sinceTimePeriod=2020`,
    fallback: 83.0,
  },
  {
    id: 'food_inflation',
    code: 'prc_hicp_manr',
    label: 'Food Price Inflation',
    unit: '%',
    category: 'economy',
    buildUrl: (geo) => `${BASE_URL}/prc_hicp_manr?format=JSON&lang=EN&geo=${geo}&coicop=CP01&sinceTimePeriod=2024`,
    fallback: 3.1,
  },
  // ── Living ──
  {
    id: 'youth_unemployment',
    code: 'une_rt_a',
    label: 'Youth Unemployment',
    unit: '%',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/une_rt_a?format=JSON&lang=EN&geo=${geo}&age=Y15-24&sex=T&unit=PC_ACT&sinceTimePeriod=2020`,
    fallback: 14.5,
  },
  {
    id: 'housing_prices',
    code: 'prc_hpi_q',
    label: 'Housing Price Index',
    unit: 'index',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/prc_hpi_q?format=JSON&lang=EN&geo=${geo}&purchase=TOTAL&sinceTimePeriod=2023`,
    fallback: 145,
  },
  {
    id: 'poverty_risk',
    code: 'ilc_peps01n',
    label: 'At Risk of Poverty',
    unit: '%',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/ilc_peps01n?format=JSON&lang=EN&geo=${geo}&sex=T&age=TOTAL&unit=PC&sinceTimePeriod=2018`,
    fallback: 21.6,
  },
  {
    id: 'median_income',
    code: 'ilc_di03',
    label: 'Median Income',
    unit: 'EUR/year',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/ilc_di03?format=JSON&lang=EN&geo=${geo}&indic_il=MEI_E&unit=EUR&sinceTimePeriod=2018`,
    fallback: 18000,
  },
  {
    id: 'housing_cost_burden',
    code: 'ilc_lvho07a',
    label: 'Housing Cost Overburden',
    unit: '%',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/ilc_lvho07a?format=JSON&lang=EN&geo=${geo}&incgrp=TOTAL&age=TOTAL&sex=T&sinceTimePeriod=2018`,
    fallback: 9.4,
  },
  {
    id: 'material_deprivation',
    code: 'ilc_mdsd07',
    label: 'Severe Material Deprivation',
    unit: '%',
    category: 'living',
    buildUrl: (geo) => `${BASE_URL}/ilc_mdsd07?format=JSON&lang=EN&geo=${geo}&unit=PC&sex=T&age=TOTAL&sinceTimePeriod=2018`,
    fallback: 6.1,
  },
  // ── Society ──
  {
    id: 'gini',
    code: 'ilc_di12',
    label: 'Gini Coefficient',
    unit: '',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/ilc_di12?format=JSON&lang=EN&geo=${geo}&sinceTimePeriod=2018`,
    fallback: 30.0,
  },
  {
    id: 'renewable_energy',
    code: 'nrg_ind_ren',
    label: 'Renewable Energy',
    unit: '%',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/nrg_ind_ren?format=JSON&lang=EN&geo=${geo}&nrg_bal=REN&sinceTimePeriod=2018`,
    fallback: 23.0,
  },
  {
    id: 'internet_access',
    code: 'isoc_ci_in_h',
    label: 'Internet Access',
    unit: '%',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/isoc_ci_in_h?format=JSON&lang=EN&geo=${geo}&hhtyp=TOTAL&unit=PC_HH&sinceTimePeriod=2018`,
    fallback: 92,
  },
  {
    id: 'life_expectancy',
    code: 'demo_mlexpec',
    label: 'Life Expectancy',
    unit: 'years',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/demo_mlexpec?format=JSON&lang=EN&geo=${geo}&sex=T&age=Y_LT1&sinceTimePeriod=2018`,
    fallback: 80.1,
  },
  {
    id: 'tertiary_education',
    code: 'edat_lfse_03',
    label: 'Tertiary Education (25-34)',
    unit: '%',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/edat_lfse_03?format=JSON&lang=EN&geo=${geo}&sex=T&age=Y25-34&isced11=ED5-8&sinceTimePeriod=2018`,
    fallback: 42.0,
  },
  {
    id: 'gender_pay_gap',
    code: 'earn_gr_gpgr2',
    label: 'Gender Pay Gap',
    unit: '%',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/earn_gr_gpgr2?format=JSON&lang=EN&geo=${geo}&nace_r2=B-S_X_O&sinceTimePeriod=2018`,
    fallback: 12.7,
  },
  {
    id: 'greenhouse_gas',
    code: 'env_air_gge',
    label: 'CO2 Emissions per Capita',
    unit: 'tonnes',
    category: 'society',
    buildUrl: (geo) => `${BASE_URL}/env_air_gge?format=JSON&lang=EN&geo=${geo}&airpol=GHG&src_crf=TOTXMEMONIA&unit=T_HAB&sinceTimePeriod=2018`,
    fallback: 7.8,
  },
];

// Eurostat uses 2-letter country codes but some differ from ISO
export const COUNTRY_MAP: Record<string, string> = {
  'GR': 'EL',
  'GB': 'UK',
};

export function getEurostatGeo(isoCode: string): string {
  return COUNTRY_MAP[isoCode] || isoCode;
}

export interface EurostatResponse {
  indicator: string;
  country: string;
  period: string;
  periodLabel: string;
  value: number;
  unit: string;
  label: string;
  source: string;
  category: 'economy' | 'living' | 'society';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodLabel(period: string): string {
  // Quarterly: "2024Q4" or "2024-Q4"
  const qMatch = period.match(/^(\d{4})-?Q(\d)$/);
  if (qMatch) return `Q${qMatch[2]} ${qMatch[1]}`;
  // Monthly: "2024M12" or "2024-12"
  const mMatch = period.match(/^(\d{4})-?M?(\d{1,2})$/);
  if (mMatch) {
    const monthIdx = parseInt(mMatch[2]) - 1;
    return `${MONTH_NAMES[monthIdx] || mMatch[2]} ${mMatch[1]}`;
  }
  // Annual: "2024"
  return period;
}

export function parseEurostatValue(data: Record<string, unknown>): { period: string; periodLabel: string; value: number } | null {
  const timeIndex = (data.dimension as Record<string, unknown>)?.time as Record<string, unknown>;
  const category = timeIndex?.category as Record<string, unknown>;
  const index = category?.index as Record<string, number>;
  const values = data.value as Record<string, number>;

  if (!index || !values) return null;

  // Sort periods descending (works for all formats: 2024, 2024Q4, 2024-12)
  const periods = Object.entries(index).sort(([, a], [, b]) => b - a);

  for (const [period, idx] of periods) {
    const val = values[String(idx)];
    if (val !== undefined && val !== null) {
      return { period, periodLabel: formatPeriodLabel(period), value: Math.round(val * 100) / 100 };
    }
  }
  return null;
}

async function fetchSingleIndicator(
  config: IndicatorConfig,
  country: string
): Promise<EurostatResponse | null> {
  const geo = getEurostatGeo(country);

  try {
    const url = config.buildUrl(geo);
    const response = await withSourceProbe('eurostat', () => fetch(url, { next: { revalidate: 3600 } }));

    if (!response.ok) {
      console.error(`Eurostat API error for ${config.id}/${country}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const parsed = parseEurostatValue(data);

    if (!parsed) return null;

    return {
      indicator: config.id,
      country,
      period: parsed.period,
      periodLabel: parsed.periodLabel,
      value: parsed.value,
      unit: config.unit,
      label: config.label,
      source: 'Eurostat',
      category: config.category,
    };
  } catch (error) {
    console.error(`Failed to fetch ${config.id} for ${country}:`, error);
    return null;
  }
}

export async function fetchRealEurostatData(
  country: string,
  indicatorIds: string[]
): Promise<{ success: boolean; data: EurostatResponse[]; partial?: boolean }> {
  const configs = indicatorIds
    .map((id) => INDICATORS.find((i) => i.id === id))
    .filter(Boolean) as IndicatorConfig[];

  const results = await Promise.allSettled(
    configs.map((c) => fetchSingleIndicator(c, country))
  );

  const data: EurostatResponse[] = [];
  let hasFailures = false;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      data.push(result.value);
    } else {
      hasFailures = true;
      const config = configs[i];
      data.push({
        indicator: config.id,
        country,
        period: '2024',
        periodLabel: '2024',
        value: config.fallback,
        unit: config.unit,
        label: config.label + ' (est.)',
        source: 'Estimate',
        category: config.category,
      });
    }
  }

  return { success: true, data, partial: hasFailures };
}

export async function fetchCountryIndicators(
  country: string,
  indicatorIds: string[]
): Promise<Record<string, { value: number; period: string }>> {
  const result = await fetchRealEurostatData(country, indicatorIds);
  return Object.fromEntries(
    result.data.map((entry) => [entry.indicator, { value: entry.value, period: entry.period }])
  );
}

// Fetch data for EU27 average alongside country
export async function fetchWithEUComparison(
  country: string,
  indicatorIds: string[]
): Promise<{
  success: boolean;
  country: EurostatResponse[];
  eu: EurostatResponse[];
}> {
  const [countryData, euData] = await Promise.all([
    fetchRealEurostatData(country, indicatorIds),
    fetchRealEurostatData('EU27_2020', indicatorIds),
  ]);

  return {
    success: true,
    country: countryData.data,
    eu: euData.data,
  };
}

// All indicator IDs by category
export function getIndicatorsByCategory(category: 'economy' | 'living' | 'society'): IndicatorConfig[] {
  return INDICATORS.filter((i) => i.category === category);
}

export function getAllIndicatorIds(): string[] {
  return INDICATORS.map((i) => i.id);
}

// Label/hint helpers for translation
export const INDICATOR_HINTS: Record<string, string> = {
  minimum_wages: 'Monthly gross minimum wage',
  housing_prices: 'House Price Index (2015 = 100)',
  gini: 'Income inequality (0 = equal, 100 = unequal)',
  inflation: 'Annual rate of price change',
  unemployment: 'Share of labour force without work',
  gdp_growth: 'Annual real GDP growth rate',
  youth_unemployment: 'Unemployment rate, under 25',
  poverty_risk: 'At risk of poverty or social exclusion',
  renewable_energy: 'Share of energy from renewables',
  internet_access: 'Households with internet access',
  gov_debt: 'Government debt as % of GDP',
  food_inflation: 'Annual food price change',
  median_income: 'Median equivalised net income',
  housing_cost_burden: '% spending 40%+ of income on housing',
  material_deprivation: 'Cannot afford 4+ basic items',
  life_expectancy: 'Expected years of life at birth',
  tertiary_education: '% with higher education degree',
  gender_pay_gap: 'Difference in average earnings M/F',
  greenhouse_gas: 'Greenhouse gas emissions per person',
};

export function getIndicatorLabels(): Record<string, string> {
  return Object.fromEntries(INDICATORS.map((i) => [i.id, i.label]));
}

export function getIndicatorHints(): Record<string, string> {
  return { ...INDICATOR_HINTS };
}
