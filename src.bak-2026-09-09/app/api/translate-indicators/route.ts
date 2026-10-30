import { NextRequest, NextResponse } from 'next/server';
import { LANG_ENGLISH } from '@/lib/i18n';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { lang, labels, hints } = body;

  if (!lang || lang === 'en') {
    return NextResponse.json({ labels: labels || {}, hints: hints || {} });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ labels, hints });
  }

  const langName = LANG_ENGLISH[lang] || lang;

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
            content: `You are a professional translator specializing in EU statistics and demographics. Translate the following Eurostat indicator names and descriptions from English to ${langName}. These are official statistical indicators used by Eurostat (e.g. "Life Expectancy" = demographic life expectancy at birth, "Median Income" = median equivalised net income). Keep JSON keys unchanged. Use the standard official terminology for economic and demographic indicators in ${langName}. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ labels, hints }),
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ labels, hints });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ labels, hints });
    }

    let translated;
    try {
      translated = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ labels, hints });
    }
    return NextResponse.json({
      labels: translated.labels || labels,
      hints: translated.hints || hints,
    });
  } catch {
    return NextResponse.json({ labels, hints });
  }
}
