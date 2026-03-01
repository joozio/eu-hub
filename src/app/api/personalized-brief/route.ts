import { NextRequest } from 'next/server';
import { checkRateLimit, fetchWithTimeout, isRecord } from '@/lib/api-guard';
import { jsonWithRequestId } from '@/lib/request-id';
import { withSourceProbe } from '@/lib/source-registry';
import { getRequestDemoMode } from '@/lib/demo-mode';
import { PriorityTheme, UserProfile } from '@/types';

interface StatEntry {
  indicator: string;
  value: number;
  unit: string;
  label: string;
  source?: string;
}

interface FeedEntry {
  title: string;
  summary?: string;
  sourceUrl: string;
  source?: string;
}

function asProfile(value: unknown): UserProfile {
  if (!isRecord(value)) return { country: '', age: 30 };

  const themes = Array.isArray(value.priorityThemes)
    ? value.priorityThemes.filter((theme): theme is PriorityTheme =>
      typeof theme === 'string'
      && ['cost_of_living', 'jobs', 'family', 'rights', 'climate', 'digital'].includes(theme)
    )
    : undefined;

  return {
    country: typeof value.country === 'string' ? value.country : '',
    age: typeof value.age === 'number' ? value.age : 30,
    employmentStatus: typeof value.employmentStatus === 'string' ? value.employmentStatus : undefined,
    industry: typeof value.industry === 'string' ? value.industry : undefined,
    housingStatus: typeof value.housingStatus === 'string' ? value.housingStatus : undefined,
    isParent: value.isParent === true,
    priorityThemes: themes,
  };
}

const THEME_HINTS: Record<PriorityTheme, string> = {
  cost_of_living: 'Focus on inflation, wages, housing, and affordability support.',
  jobs: 'Focus on employment rates, upskilling, and labour market changes.',
  family: 'Focus on healthcare, education, parental rights, and social protections.',
  rights: 'Focus on privacy, consumer rights, and legal guarantees.',
  climate: 'Focus on energy transition impacts and climate programs.',
  digital: 'Focus on AI, data rules, and digital market regulation.',
};

function asStatArray(value: unknown): StatEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .slice(0, 8)
    .map((row) => ({
      indicator: typeof row.indicator === 'string' ? row.indicator : 'unknown',
      value: typeof row.value === 'number' ? row.value : Number(row.value) || 0,
      unit: typeof row.unit === 'string' ? row.unit : '',
      label: typeof row.label === 'string' ? row.label : String(row.indicator || 'Indicator'),
      source: typeof row.source === 'string' ? row.source : 'Eurostat',
    }));
}

function asFeedArray(value: unknown): FeedEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .slice(0, 6)
    .map((row) => ({
      title: typeof row.title === 'string' ? row.title : 'EU update',
      summary: typeof row.summary === 'string' ? row.summary : '',
      sourceUrl: typeof row.sourceUrl === 'string' ? row.sourceUrl : 'https://ec.europa.eu/commission/presscorner/home/en',
      source: typeof row.source === 'string' ? row.source : 'EU Source',
    }));
}

function buildDeterministicBrief(profile: UserProfile, stats: StatEntry[], feed: FeedEntry[]) {
  const selectedThemes = (profile.priorityThemes || []).slice(0, 3);
  const themeLine = selectedThemes.length > 0
    ? selectedThemes.map((theme) => THEME_HINTS[theme]).join(' ')
    : 'Focus on the strongest movement in jobs, affordability, and rights.';

  const topStat = stats[0];
  const secondStat = stats[1];
  const topNews = feed[0];

  const opportunities = [
    topNews
      ? `Policy momentum: ${topNews.title}.`
      : 'Policy momentum: EU institutions are actively updating citizen-impacting regulations.',
    topStat
      ? `Key indicator to watch: ${topStat.label} at ${topStat.value}${topStat.unit}.`
      : 'Key indicator to watch: monitor unemployment and inflation direction month to month.',
  ];

  const risks = [
    secondStat
      ? `Gap risk: ${secondStat.label} may indicate uneven outcomes between member states.`
      : 'Gap risk: implementation speed differs across member states and can delay local impact.',
    'Execution risk: national transposition timelines can slow policy benefits for households and workers.',
  ];

  const action = [
    'Track one policy file and one statistic weekly, then compare your country against EU average.',
    themeLine,
  ];

  const citations = [
    {
      label: topNews?.source || 'European Commission Press Corner',
      url: topNews?.sourceUrl || 'https://ec.europa.eu/commission/presscorner/home/en',
      source: topNews?.source || 'European Commission',
    },
    {
      label: 'Eurostat Data Browser',
      url: 'https://ec.europa.eu/eurostat/databrowser',
      source: 'Eurostat',
    },
  ];

  return {
    brief: 'Your EU Impact Brief is generated from current policy updates and your selected priorities.',
    sections: [
      { title: 'Top opportunities', items: opportunities },
      { title: 'Key risks', items: risks },
      { title: 'One action this week', items: action },
    ],
    citations,
    mode: 'fallback' as const,
  };
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-personalized-brief', max: 20, windowMs: 60_000 });
  if (limited) return limited;

  const demoMode = getRequestDemoMode(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithRequestId(req, { error: 'Invalid request body' }, 400);
  }

  if (!isRecord(body)) {
    return jsonWithRequestId(req, { error: 'Invalid request body' }, 400);
  }

  const profile = asProfile(body.profile);
  const stats = asStatArray(body.topStats);
  const feed = asFeedArray(body.topFeedItems);

  const fallbackResult = buildDeterministicBrief(profile, stats, feed);
  if (demoMode === 'snapshot') {
    return jsonWithRequestId(req, fallbackResult);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonWithRequestId(req, fallbackResult);
  }

  try {
    const response = await withSourceProbe('mistral', () => fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: 'Create a concise citizen brief with 3 sections: Top opportunities, Key risks, One action this week. Use JSON only with keys brief, sections, citations. Keep items specific and practical.'
          },
          {
            role: 'user',
            content: JSON.stringify({ profile, stats, feed }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    }, 20_000));

    if (!response.ok) {
      return jsonWithRequestId(req, fallbackResult);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') {
      return jsonWithRequestId(req, fallbackResult);
    }

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.sections)) {
      return jsonWithRequestId(req, fallbackResult);
    }

    const safeResult = {
      brief: typeof parsed.brief === 'string' ? parsed.brief : fallbackResult.brief,
      sections: parsed.sections,
      citations: Array.isArray(parsed.citations) ? parsed.citations : fallbackResult.citations,
      mode: 'ai' as const,
    };

    return jsonWithRequestId(req, safeResult);
  } catch {
    return jsonWithRequestId(req, fallbackResult);
  }
}
