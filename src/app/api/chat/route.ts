import { NextRequest } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';
import {
  asAge,
  asBoolean,
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
  const limited = checkRateLimit(req, { key: 'api-chat', max: 30, windowMs: 60_000 });
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

  const question = asTrimmedString(body.question, 1200);
  const country = asCountryCode(body.country);
  const age = asAge(body.age);
  const employmentStatus = asTrimmedString(body.employmentStatus, 40);
  const industry = asTrimmedString(body.industry, 40);
  const housingStatus = asTrimmedString(body.housingStatus, 40);
  const isParent = asBoolean(body.isParent);

  if (!question || !country) {
    return jsonWithRequestId(req, { error: 'Missing required fields' }, 400);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonWithRequestId(req, { error: 'Mistral API key not configured' }, 500);
  }

  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);

  // Build profile context for richer responses
  const profileParts: string[] = [`lives in ${countryName}`, `${age} years old`];
  if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);
  if (industry) profileParts.push(`industry: ${industry}`);
  if (isParent) profileParts.push('is a parent');
  if (housingStatus) profileParts.push(`housing: ${housingStatus}`);

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
            content: `You are EU Hub AI, an expert assistant that explains European Union legislation, policies, and statistics in plain, accessible language.

The user: ${profileParts.join(', ')}. Always relate your answers to how EU policies specifically affect someone in their situation.

IMPORTANT: Respond entirely in ${language}.

Guidelines:
- Be concise and factual (2-3 paragraphs max)
- Cite specific EU regulations, directives, or programs by name
- Mention relevant dates (when laws take effect, deadlines)
- If relevant, mention country-specific implementation details for ${countryName}
- Use plain language, avoid legal jargon
- End with one actionable takeaway or next step for the user`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    }, 20_000));

    if (!response.ok) {
      // Log only the status: upstream error bodies can echo the user's question.
      console.error('Mistral API error:', response.status);
      return jsonWithRequestId(req, { error: 'Mistral API error' }, 502);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No response received.';

    return jsonWithRequestId(req, { answer, model: data.model });
  } catch (error) {
    console.error('Mistral API call failed:', error);
    return jsonWithRequestId(req, { error: 'Failed to get response from Mistral AI' }, 500);
  }
}
