import { guarded, readJSON, modelFetch, GuardError } from '@/lib/model-guard';
import { profile } from '@/lib/model-schema';
import { NextRequest } from 'next/server';
import { getLangEnglish } from '@/lib/i18n';
import { COUNTRY_NAMES } from '@/lib/countries';

async function handle(req: NextRequest) {
  const body = profile(await readJSON(req), true);
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
    response = await modelFetch('https://api.mistral.ai/v1/chat/completions', {
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
  } catch (error) {
    if (error instanceof GuardError) throw error;
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
  const reader = response.body.getReader();
  let buffer = '';
  let canceled = false;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (!canceled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (typeof content === 'string' && !canceled) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch { /* Ignore non-content SSE frames. */ }
          }
        }
        if (!canceled) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      } catch {
        if (!canceled) controller.error(new Error('AI stream ended'));
      } finally { await reader.cancel().catch(() => {}); }
    },
    async cancel() { canceled = true; await reader.cancel().catch(() => {}); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export const POST = guarded(handle);
