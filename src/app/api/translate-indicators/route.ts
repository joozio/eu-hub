import { NextRequest, NextResponse } from 'next/server';
import { LANG_ENGLISH, normalizeLangCode } from '@/lib/i18n';
import {
  asTrimmedString,
  checkRateLimit,
  fetchWithTimeout,
  isRecord,
  requireJsonContentType,
} from '@/lib/api-guard';

// Indicator ids look like "gdp_growth"; there are fewer than 30 of them.
const MAX_MAP_KEYS = 64;
const INDICATOR_KEY_RE = /^[a-z0-9_]{1,40}$/;

function sanitizeStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(value)) {
    if (count >= MAX_MAP_KEYS) break;
    if (typeof v !== 'string' || !INDICATOR_KEY_RE.test(k)) continue;
    out[k] = v.slice(0, 200);
    count += 1;
  }
  return out;
}

const STATIC_LABEL_OVERRIDES: Record<string, { labels: Record<string, string>; hints: Record<string, string> }> = {
  pl: {
    labels: {
      inflation: 'Inflacja (HICP)',
      unemployment: 'Stopa bezrobocia',
      gdp_growth: 'Wzrost PKB',
      minimum_wages: 'Płaca minimalna',
      gov_debt: 'Dług publiczny',
      food_inflation: 'Inflacja cen żywności',
      youth_unemployment: 'Bezrobocie młodych',
      housing_prices: 'Indeks cen mieszkań',
      poverty_risk: 'Ryzyko ubóstwa',
      median_income: 'Dochód medianowy',
      housing_cost_burden: 'Nadmierne koszty mieszkaniowe',
      material_deprivation: 'Poważna deprywacja materialna',
      gini: 'Współczynnik Giniego',
      renewable_energy: 'Energia odnawialna',
      internet_access: 'Dostęp do internetu',
      life_expectancy: 'Oczekiwana długość życia',
      tertiary_education: 'Wykształcenie wyższe (25-34)',
      gender_pay_gap: 'Luka płacowa kobiet i mężczyzn',
      greenhouse_gas: 'Emisje CO2 na osobę',
    },
    hints: {
      minimum_wages: 'Miesięczna płaca minimalna brutto',
      housing_prices: 'Indeks cen mieszkań (2015 = 100)',
      gini: 'Nierówność dochodów (0 = równość, 100 = nierówność)',
      inflation: 'Roczna dynamika cen',
      unemployment: 'Udział siły roboczej bez pracy',
      gdp_growth: 'Roczna realna dynamika PKB',
      youth_unemployment: 'Stopa bezrobocia poniżej 25 lat',
      poverty_risk: 'Ryzyko ubóstwa lub wykluczenia społecznego',
      renewable_energy: 'Udział energii z OZE',
      internet_access: 'Gospodarstwa domowe z dostępem do internetu',
      gov_debt: 'Dług publiczny jako % PKB',
      food_inflation: 'Roczna dynamika cen żywności',
      median_income: 'Medianowy dochód ekwiwalentny netto',
      housing_cost_burden: '% wydających 40%+ dochodu na mieszkanie',
      material_deprivation: 'Brak możliwości opłacenia 4+ podstawowych potrzeb',
      life_expectancy: 'Oczekiwana długość życia przy urodzeniu',
      tertiary_education: '% osób z wykształceniem wyższym',
      gender_pay_gap: 'Różnica średnich zarobków K/M',
      greenhouse_gas: 'Emisje gazów cieplarnianych na osobę',
    },
  },
};

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-translate-indicators', max: 40, windowMs: 60_000 });
  if (limited) return limited;

  const wrongType = requireJsonContentType(req);
  if (wrongType) return wrongType;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const lang = normalizeLangCode(asTrimmedString(body.lang, 8));
  const labels = sanitizeStringMap(body.labels);
  const hints = sanitizeStringMap(body.hints);
  const staticOverrides = STATIC_LABEL_OVERRIDES[lang];
  const mergedBase = {
    labels: { ...labels, ...(staticOverrides?.labels || {}) },
    hints: { ...hints, ...(staticOverrides?.hints || {}) },
  };

  if (!lang || lang === 'en') {
    return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
  }

  const langName = LANG_ENGLISH[lang] || lang;

  try {
    const response = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator specializing in EU statistics and demographics. Translate the following Eurostat indicator names and descriptions from English to ${langName}. These are official statistical indicators used by Eurostat (e.g. "Life Expectancy" = demographic life expectancy at birth, "Median Income" = median equivalised net income). Keep JSON keys unchanged. Use the standard official terminology for economic and demographic indicators in ${langName}. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ labels: mergedBase.labels, hints: mergedBase.hints }),
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    }, 20_000);

    if (!response.ok) {
      return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
    }

    let translated;
    try {
      translated = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
    }
    return NextResponse.json({
      labels: { ...(translated.labels || mergedBase.labels), ...(staticOverrides?.labels || {}) },
      hints: { ...(translated.hints || mergedBase.hints), ...(staticOverrides?.hints || {}) },
    });
  } catch {
    return NextResponse.json({ labels: mergedBase.labels, hints: mergedBase.hints });
  }
}
