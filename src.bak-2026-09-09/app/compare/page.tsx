'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation, countryFlag, countryName } from '@/hooks/useProfile';
import CountrySelector from '@/components/CountrySelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SkeletonStat } from '@/components/ui/skeleton';
import { ShareButton } from '@/components/ui/share-button';
import { EU_COUNTRIES } from '@/lib/countries';
import { getCurrency, isEurozone, eurToLocal } from '@/lib/currencies';

const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const COUNTRY_MAP: Record<string, string> = { 'GR': 'EL', 'GB': 'UK' };

function getGeo(code: string) { return COUNTRY_MAP[code] || code; }

interface IndicatorConfig {
  id: string;
  label: string;
  unit: string;
  category: 'economy' | 'living' | 'society';
  higherIsBetter: boolean;
  buildUrl: (geo: string) => string;
  fallback: number;
}

const COMPARE_INDICATORS: IndicatorConfig[] = [
  { id: 'unemployment', label: 'Unemployment Rate', unit: '%', category: 'economy', higherIsBetter: false, buildUrl: g => `${BASE_URL}/une_rt_a?format=JSON&lang=EN&geo=${g}&age=Y15-74&sex=T&unit=PC_ACT&sinceTimePeriod=2020`, fallback: 6.1 },
  { id: 'gdp_growth', label: 'GDP Growth', unit: '%', category: 'economy', higherIsBetter: true, buildUrl: g => `${BASE_URL}/namq_10_gdp?format=JSON&lang=EN&geo=${g}&na_item=B1GQ&unit=CLV_PCH_PRE&s_adj=SCA&sinceTimePeriod=2024`, fallback: 0.9 },
  { id: 'minimum_wages', label: 'Minimum Wage', unit: 'EUR/month', category: 'economy', higherIsBetter: true, buildUrl: g => `${BASE_URL}/earn_mw_cur?format=JSON&lang=EN&geo=${g}&currency=EUR&sinceTimePeriod=2020`, fallback: 1050 },
  { id: 'inflation', label: 'Inflation (HICP)', unit: '%', category: 'economy', higherIsBetter: false, buildUrl: g => `${BASE_URL}/prc_hicp_manr?format=JSON&lang=EN&geo=${g}&coicop=CP00&sinceTimePeriod=2024`, fallback: 2.4 },
  { id: 'gov_debt', label: 'Government Debt', unit: '%', category: 'economy', higherIsBetter: false, buildUrl: g => `${BASE_URL}/gov_10dd_edpt1?format=JSON&lang=EN&geo=${g}&na_item=GD&sector=S13&unit=PC_GDP&sinceTimePeriod=2020`, fallback: 83.0 },
  { id: 'median_income', label: 'Median Income', unit: 'EUR/year', category: 'living', higherIsBetter: true, buildUrl: g => `${BASE_URL}/ilc_di03?format=JSON&lang=EN&geo=${g}&indic_il=MEI_E&unit=EUR&sinceTimePeriod=2018`, fallback: 18000 },
  { id: 'poverty_risk', label: 'At Risk of Poverty', unit: '%', category: 'living', higherIsBetter: false, buildUrl: g => `${BASE_URL}/ilc_peps01n?format=JSON&lang=EN&geo=${g}&sex=T&age=TOTAL&unit=PC&sinceTimePeriod=2018`, fallback: 21.6 },
  { id: 'housing_cost_burden', label: 'Housing Cost Overburden', unit: '%', category: 'living', higherIsBetter: false, buildUrl: g => `${BASE_URL}/ilc_lvho07a?format=JSON&lang=EN&geo=${g}&incgrp=TOTAL&age=TOTAL&sex=T&sinceTimePeriod=2018`, fallback: 9.4 },
  { id: 'youth_unemployment', label: 'Youth Unemployment', unit: '%', category: 'living', higherIsBetter: false, buildUrl: g => `${BASE_URL}/une_rt_a?format=JSON&lang=EN&geo=${g}&age=Y15-24&sex=T&unit=PC_ACT&sinceTimePeriod=2020`, fallback: 14.5 },
  { id: 'life_expectancy', label: 'Life Expectancy', unit: 'years', category: 'society', higherIsBetter: true, buildUrl: g => `${BASE_URL}/demo_mlexpec?format=JSON&lang=EN&geo=${g}&sex=T&age=Y_LT1&sinceTimePeriod=2018`, fallback: 80.1 },
  { id: 'renewable_energy', label: 'Renewable Energy', unit: '%', category: 'society', higherIsBetter: true, buildUrl: g => `${BASE_URL}/nrg_ind_ren?format=JSON&lang=EN&geo=${g}&nrg_bal=REN&sinceTimePeriod=2018`, fallback: 23.0 },
  { id: 'gender_pay_gap', label: 'Gender Pay Gap', unit: '%', category: 'society', higherIsBetter: false, buildUrl: g => `${BASE_URL}/earn_gr_gpgr2?format=JSON&lang=EN&geo=${g}&nace_r2=B-S_X_O&sinceTimePeriod=2018`, fallback: 12.7 },
  { id: 'gini', label: 'Gini (Inequality)', unit: '', category: 'society', higherIsBetter: false, buildUrl: g => `${BASE_URL}/ilc_di12?format=JSON&lang=EN&geo=${g}&sinceTimePeriod=2018`, fallback: 30.0 },
  { id: 'tertiary_education', label: 'Tertiary Education', unit: '%', category: 'society', higherIsBetter: true, buildUrl: g => `${BASE_URL}/edat_lfse_03?format=JSON&lang=EN&geo=${g}&sex=T&age=Y25-34&isced11=ED5-8&sinceTimePeriod=2018`, fallback: 42.0 },
];

type Category = 'all' | 'economy' | 'living' | 'society';

interface CountryData {
  [indicatorId: string]: { value: number; period: string };
}

function parseLatest(data: Record<string, unknown>, fallback: number): { value: number; period: string } {
  try {
    const timeIndex = (data.dimension as Record<string, unknown>)?.time as Record<string, unknown>;
    const index = (timeIndex?.category as Record<string, unknown>)?.index as Record<string, number>;
    const values = data.value as Record<string, number>;
    if (!index || !values) return { value: fallback, period: '—' };
    const sorted = Object.entries(index).sort(([, a], [, b]) => b - a);
    for (const [period, idx] of sorted) {
      const v = values[String(idx)];
      if (v != null) return { value: Math.round(v * 100) / 100, period };
    }
  } catch { /* noop */ }
  return { value: fallback, period: '—' };
}

async function fetchCountryData(country: string): Promise<CountryData> {
  const geo = getGeo(country);
  const results = await Promise.allSettled(
    COMPARE_INDICATORS.map(async (ind) => {
      try {
        const res = await fetch(ind.buildUrl(geo));
        if (!res.ok) return { id: ind.id, ...(parseLatest({}, ind.fallback)) };
        const data = await res.json();
        return { id: ind.id, ...parseLatest(data, ind.fallback) };
      } catch {
        return { id: ind.id, value: ind.fallback, period: '—' };
      }
    })
  );
  const out: CountryData = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      out[r.value.id] = { value: r.value.value, period: r.value.period };
    }
  });
  return out;
}

function formatVal(value: number, unit: string, country: string): string {
  if (unit === 'EUR/month') {
    if (!isEurozone(country)) {
      const c = getCurrency(country);
      return `${eurToLocal(value, country).toLocaleString()} ${c.code}/mo`;
    }
    return `€${Math.round(value).toLocaleString()}/mo`;
  }
  if (unit === 'EUR/year') {
    if (!isEurozone(country)) {
      const c = getCurrency(country);
      return `${eurToLocal(value, country).toLocaleString()} ${c.code}`;
    }
    return `€${Math.round(value).toLocaleString()}`;
  }
  if (unit === 'years') return `${value.toFixed(1)} yr`;
  if (unit === '') return value.toFixed(1);
  return `${value.toFixed(1)}${unit}`;
}

export default function ComparePage() {
  const { t, profile } = useTranslation();

  const [c1, setC1] = useState(profile.country || 'DE');
  const [c2, setC2] = useState('FR');
  const [data1, setData1] = useState<CountryData>({});
  const [data2, setData2] = useState<CountryData>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('all');

  const load = useCallback(async () => {
    if (!c1 || !c2 || c1 === c2) return;
    setLoading(true);
    setData1({});
    setData2({});
    const [d1, d2] = await Promise.all([fetchCountryData(c1), fetchCountryData(c2)]);
    setData1(d1);
    setData2(d2);
    setLoading(false);
  }, [c1, c2]);

  useEffect(() => { load(); }, [load]);

  // Use profile country as default c1 once loaded
  useEffect(() => {
    if (profile.country && c1 === 'DE') setC1(profile.country);
  }, [profile.country]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleIndicators = COMPARE_INDICATORS.filter(
    ind => activeTab === 'all' || ind.category === activeTab
  );

  // Score: count wins per country
  const scores = { c1: 0, c2: 0, ties: 0 };
  COMPARE_INDICATORS.forEach(ind => {
    const v1 = data1[ind.id]?.value;
    const v2 = data2[ind.id]?.value;
    if (v1 == null || v2 == null) return;
    const diff = v1 - v2;
    const eps = 0.05;
    if (Math.abs(diff) < eps) { scores.ties++; return; }
    const c1Better = ind.higherIsBetter ? diff > 0 : diff < 0;
    if (c1Better) scores.c1++; else scores.c2++;
  });
  const total = scores.c1 + scores.c2 + scores.ties;

  const n1 = countryName(c1);
  const n2 = countryName(c2);

  const CATEGORY_COLORS = {
    economy: '#003399',
    living: '#6366f1',
    society: '#10b981',
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003399] to-[#0044cc]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                Compare Countries
              </h1>
              <p className="text-white/70 text-sm mt-1">Side-by-side Eurostat data for any two EU countries</p>
            </div>
            <ShareButton title={`EU Hub: ${n1} vs ${n2}`} text={`Comparing ${n1} and ${n2} across 14 EU indicators`} size="sm" className="shrink-0 mt-1" />
          </div>

          {/* Country pickers */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Country A</p>
              <CountrySelector
                onSelect={setC1}
                selectedCountry={c1}
                searchPlaceholder="Search countries..."
                placeholder="Select country"
                noResultsText="No countries found"
              />
            </div>
            <div className="flex items-center justify-center">
              <span className="text-white/60 text-sm font-bold px-2 py-3 sm:py-0">VS</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Country B</p>
              <CountrySelector
                onSelect={setC2}
                selectedCountry={c2}
                searchPlaceholder="Search countries..."
                placeholder="Select country"
                noResultsText="No countries found"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {c1 === c2 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
            Please select two different countries to compare.
          </div>
        )}

        {/* Head-to-head scorecard */}
        {!loading && total > 0 && c1 !== c2 && (
          <div className="mb-6 animate-slide-up">
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Head-to-Head Score ({total} indicators)</p>
                <div className="flex items-center gap-3">
                  {/* Country A */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl sm:text-4xl mb-1">{countryFlag(c1)}</p>
                    <p className="font-bold text-gray-900 text-sm truncate">{n1}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: scores.c1 >= scores.c2 ? '#003399' : '#94a3b8' }}>
                      {scores.c1}
                    </p>
                    <p className="text-xs text-gray-500">wins</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-[2] flex flex-col items-center gap-1.5">
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all duration-700 ease-out"
                        style={{ width: total > 0 ? `${(scores.c1 / total) * 100}%` : '50%', background: 'linear-gradient(90deg, #003399, #3b82f6)' }}
                      />
                      {scores.ties > 0 && (
                        <div
                          className="h-full bg-gray-300 transition-all duration-700 ease-out"
                          style={{ width: `${(scores.ties / total) * 100}%` }}
                        />
                      )}
                      <div
                        className="h-full rounded-r-full transition-all duration-700 ease-out"
                        style={{ width: total > 0 ? `${(scores.c2 / total) * 100}%` : '50%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                      />
                    </div>
                    {scores.ties > 0 && (
                      <p className="text-xs text-gray-400">{scores.ties} tied</p>
                    )}
                    <p className="text-xs font-semibold text-gray-600">
                      {scores.c1 > scores.c2 ? `${n1} leads` : scores.c2 > scores.c1 ? `${n2} leads` : 'Even match'}
                    </p>
                  </div>

                  {/* Country B */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl sm:text-4xl mb-1">{countryFlag(c2)}</p>
                    <p className="font-bold text-gray-900 text-sm truncate">{n2}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: scores.c2 >= scores.c1 ? '#6366f1' : '#94a3b8' }}>
                      {scores.c2}
                    </p>
                    <p className="text-xs text-gray-500">wins</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">All ({COMPARE_INDICATORS.length})</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
            <TabsTrigger value="living">Living</TabsTrigger>
            <TabsTrigger value="society">Society</TabsTrigger>
          </TabsList>

          {(['all', 'economy', 'living', 'society'] as Category[]).map(cat => (
            <TabsContent key={cat} value={cat}>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => <SkeletonStat key={i} />)}
                </div>
              ) : c1 === c2 ? null : (
                <div className="space-y-3">
                  {visibleIndicators.map((ind, idx) => {
                    const v1 = data1[ind.id]?.value ?? null;
                    const v2 = data2[ind.id]?.value ?? null;

                    if (v1 == null || v2 == null) return null;

                    const diff = v1 - v2;
                    const eps = 0.05;
                    const isTied = Math.abs(diff) < eps;
                    const c1Wins = !isTied && (ind.higherIsBetter ? diff > 0 : diff < 0);
                    const c2Wins = !isTied && !c1Wins;

                    const maxVal = Math.max(Math.abs(v1), Math.abs(v2), 0.01);
                    const bar1Width = Math.min((Math.abs(v1) / maxVal) * 100, 100);
                    const bar2Width = Math.min((Math.abs(v2) / maxVal) * 100, 100);

                    const catColor = CATEGORY_COLORS[ind.category];

                    return (
                      <div
                        key={ind.id}
                        className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5 animate-slide-up hover:shadow-sm transition-shadow"
                        style={{ animationDelay: `${idx * 40}ms` }}
                        role="row"
                        aria-label={`${ind.label}: ${n1} ${v1}${ind.unit} vs ${n2} ${v2}${ind.unit}`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                            <p className="text-sm font-semibold text-gray-800">{ind.label}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isTied ? 'bg-gray-100 text-gray-500' : c1Wins ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {isTied ? 'Tied' : c1Wins ? `${countryFlag(c1)} wins` : `${countryFlag(c2)} wins`}
                          </span>
                        </div>

                        {/* Country A bar */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-base flex-shrink-0 w-6 text-center">{countryFlag(c1)}</span>
                          <div className="flex-1">
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${bar1Width}%`,
                                  backgroundColor: c1Wins ? '#003399' : isTied ? '#64748b' : '#cbd5e1',
                                }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums min-w-[80px] text-right ${c1Wins ? 'text-blue-700' : 'text-gray-600'}`}>
                            {formatVal(v1, ind.unit, c1)}
                          </span>
                        </div>

                        {/* Country B bar */}
                        <div className="flex items-center gap-3">
                          <span className="text-base flex-shrink-0 w-6 text-center">{countryFlag(c2)}</span>
                          <div className="flex-1">
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${bar2Width}%`,
                                  backgroundColor: c2Wins ? '#6366f1' : isTied ? '#64748b' : '#cbd5e1',
                                }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums min-w-[80px] text-right ${c2Wins ? 'text-indigo-700' : 'text-gray-600'}`}>
                            {formatVal(v2, ind.unit, c2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
