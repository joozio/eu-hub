import { NextRequest } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';
import { EU_COMPARISONS } from '@/lib/eu-comparisons';
import {
  asAge,
  asCountryCode,
  asTrimmedString,
  checkRateLimit,
  fetchWithTimeout,
  isRecord,
  requireJsonContentType,
} from '@/lib/api-guard';
import { withSourceProbe } from '@/lib/source-registry';
import { jsonWithRequestId } from '@/lib/request-id';

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { key: 'api-eu-comparison-insight', max: 20, windowMs: 60_000 });
  if (limited) return limited;

  const wrongType = requireJsonContentType(req);
  if (wrongType) return wrongType;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithRequestId(req, { error: 'Invalid request body' }, 400);
  }

  if (!isRecord(body)) {
    return jsonWithRequestId(req, { error: 'Invalid request body' }, 400);
  }

  const country = asCountryCode(body.country);
  const age = asAge(body.age);
  const employmentStatus = asTrimmedString(body.employmentStatus, 40);

  if (!country) {
    return jsonWithRequestId(req, { error: 'Missing required fields' }, 400);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonWithRequestId(req, { error: 'Mistral API key not configured' }, 500);
  }

  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);

  const comparisonSummary = EU_COMPARISONS.map(
    (c) => `- ${c.topic} [${c.source}]: EU: ${c.euValue} | World: ${c.worldAvg} (${c.sentiment})`
  ).join('\n');

  const profileParts = [`${age} years old`, `lives in ${countryName}`];
  if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);

  try {
    const response = await withSourceProbe('mistral', () => fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
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
            content: `You help EU citizens understand how living in the EU compares globally. You have deep knowledge of EU law and policy. Reference specific EU Directives and Regulations by name when relevant. Be specific about how advantages or disadvantages affect this person personally based on their age, country, and employment.

IMPORTANT: Respond entirely in ${language}. Do not use markdown. Keep it to 3-4 sentences.`,
          },
          {
            role: 'user',
            content: `Based on these EU vs world comparisons backed by official EU sources, write a personalized interpretation for someone who is ${profileParts.join(', ')}. Focus on the 2-3 comparisons most relevant to their situation. Mention which specific EU law gives them these rights.\n\n${comparisonSummary}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 350,
      }),
    }, 20_000));

    if (!response.ok) {
      return jsonWithRequestId(req, { error: 'Mistral API error' }, 502);
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content || '';

    return jsonWithRequestId(req, { insight, model: data.model });
  } catch {
    return jsonWithRequestId(req, { error: 'Failed to generate insight' }, 500);
  }
}
