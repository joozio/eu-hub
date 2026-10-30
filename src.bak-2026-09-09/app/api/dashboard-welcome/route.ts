import { NextRequest, NextResponse } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';

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

  const profileParts = [`${age} years old`, `in ${countryName}`];
  if (employmentStatus) profileParts.push(`${employmentStatus}`);

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
            content: `You are EU Hub, a knowledgeable assistant helping EU citizens understand how the EU affects their daily life. You know current EU policy developments in detail.

Generate a warm 2-3 sentence personalized greeting. Mention ONE specific current EU initiative relevant to this person, such as:
- AI Act (Regulation 2024/1689) full enforcement starting Aug 2025
- Digital Identity Wallet (eIDAS 2.0) rollout by 2026
- Right to Repair Directive implementation
- Fit for 55 climate targets and their local impact
- European Health Data Space proposal
- EU Chips Act semiconductor investments
- Youth Guarantee expanded program
- Minimum Wage Directive (2022/2041) implementation
- Platform Workers Directive 2024
- EU Digital Euro preparations

Pick the one most relevant to the user's age, country, and employment. Be factual and cite the regulation name.

IMPORTANT: Respond entirely in ${language}. No markdown. No bullet points. Just natural sentences.`,
          },
          {
            role: 'user',
            content: `Generate a dashboard welcome for someone who is ${profileParts.join(', ')}.`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Mistral API error' }, { status: response.status });
    }

    const data = await response.json();
    const greeting = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ greeting, model: data.model });
  } catch {
    return NextResponse.json({ error: 'Failed to generate greeting' }, { status: 500 });
  }
}
