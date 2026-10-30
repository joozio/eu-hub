import { guarded, readJSON, modelFetch, GuardError } from '@/lib/model-guard';
import { profile } from '@/lib/model-schema';
import { NextRequest, NextResponse } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';

async function handle(req: NextRequest) {
  const body = profile(await readJSON(req), true);
  const { question, country, age, employmentStatus, industry, isParent, housingStatus } = body;

  if (!question || !country) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Mistral API key not configured' }, { status: 500 });
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
    const response = await modelFetch('https://api.mistral.ai/v1/chat/completions', {
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
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('Mistral API error:', response.status, errData);
      return NextResponse.json(
        { error: `Mistral API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No response received.';

    return NextResponse.json({ answer, model: data.model });
  } catch (error) {
    if (error instanceof GuardError) throw error;
    console.error('Mistral API call failed:', error);
    return NextResponse.json({ error: 'Failed to get response from Mistral AI' }, { status: 500 });
  }
}

export const POST = guarded(handle);
