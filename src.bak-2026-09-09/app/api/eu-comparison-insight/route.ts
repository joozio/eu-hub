import { NextRequest, NextResponse } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';
import { EU_COMPARISONS } from '@/lib/eu-comparisons';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { country, age, employmentStatus } = body;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Mistral API key not configured' }, { status: 500 });
  }

  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);

  const comparisonSummary = EU_COMPARISONS.map(
    (c) => `- ${c.topic} [${c.source}]: EU: ${c.euValue} | World: ${c.worldAvg} (${c.sentiment})`
  ).join('\n');

  const profileParts = [`${age} years old`, `lives in ${countryName}`];
  if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Mistral API error' }, { status: response.status });
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ insight, model: data.model });
  } catch {
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
