import { NextRequest } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { question, country, age, employmentStatus, industry, isParent } = body;

  if (!question || !country) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const countryName = COUNTRY_NAMES[country] || country;
  const language = getLangEnglish(country);

  const profileParts: string[] = [`lives in ${countryName}`, `${age} years old`];
  if (employmentStatus) profileParts.push(`employment: ${employmentStatus}`);
  if (industry) profileParts.push(`industry: ${industry}`);
  if (isParent) profileParts.push('is a parent');

  let response;
  try {
    response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are EU Hub AI, an expert assistant that explains European Union legislation, policies, and statistics in plain, accessible language.

The user: ${profileParts.join(', ')}. Always relate your answers to how EU policies specifically affect someone in their situation.

IMPORTANT: Respond entirely in ${language}.

Guidelines:
- Be concise and factual (2-3 paragraphs max)
- Cite specific EU regulations by name
- Use plain language, avoid legal jargon
- End with one actionable takeaway`,
          },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to connect to Mistral API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!response.ok || !response.body) {
    return new Response(JSON.stringify({ error: 'Mistral API error' }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

          for (const line of lines) {
            const data = line.replace('data: ', '').trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
