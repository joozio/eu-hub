'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useProfile';

export default function AskPage() {
  const router = useRouter();
  const { t, profile } = useTranslation();

  useEffect(() => {
    if (!profile.country) router.replace('/');
  }, [profile.country, router]);

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [conversation, setConversation] = useState<{ q: string; a: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const currentQuestion = question;
    setQuestion('');
    setLoading(true);
    setStreamingText('');
    setConversation(prev => [...prev, { q: currentQuestion, a: '' }]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          country: profile.country, age: profile.age,
          employmentStatus: profile.employmentStatus,
          industry: profile.industry, isParent: profile.isParent,
        }),
      });

      if (!response.ok || !response.body) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.replace(/^data:\s?/, '');
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullText += parsed.content;
              setStreamingText(fullText);
            }
          } catch { /* skip */ }
        }
      }

      const tail = buffer.trim();
      if (tail.startsWith('data:')) {
        const data = tail.replace(/^data:\s?/, '');
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullText += parsed.content;
              setStreamingText(fullText);
            }
          } catch { /* skip */ }
        }
      }

      setConversation(prev => {
        const updated = [...prev];
        updated[updated.length - 1].a = fullText;
        return updated;
      });
      setStreamingText('');
    } catch (error) {
      console.error('Stream failed:', error);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentQuestion,
            country: profile.country, age: profile.age,
            employmentStatus: profile.employmentStatus,
            industry: profile.industry, isParent: profile.isParent,
          }),
        });
        const data = await response.json();
        setConversation(prev => {
          const updated = [...prev];
          updated[updated.length - 1].a = data.answer || t('ask.error_generic');
          return updated;
        });
      } catch {
        setConversation(prev => {
          const updated = [...prev];
          updated[updated.length - 1].a = t('ask.error_offline');
          return updated;
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (q: string) => {
    setQuestion(q);
  };

  // Profile-based suggested questions
  const suggestedQuestions = [];
  if (profile.employmentStatus === 'unemployed' || profile.employmentStatus === 'student') {
    suggestedQuestions.push(t('ask.q2')); // Youth funding question
  }
  if (profile.industry === 'tech') {
    suggestedQuestions.push(t('ask.q1')); // AI Act question
  }
  if (profile.isParent) {
    suggestedQuestions.push(t('ask.q4')); // Green Deal question (family context)
  }
  if (profile.housingStatus === 'renter') {
    suggestedQuestions.push(t('ask.q3')); // Employment stats question
  }
  
  // Add generic questions if none match
  if (suggestedQuestions.length === 0) {
    suggestedQuestions.push(t('ask.q1'), t('ask.q2'), t('ask.q3'), t('ask.q4'));
  }

  const hasConversation = conversation.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full flex flex-col">
        {/* Header */}
        <div className={hasConversation ? 'mb-6' : 'mb-2'}>
          <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{t('ask.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('ask.subtitle')}</p>
        </div>

        {/* Empty state - centered */}
        {!hasConversation && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-eu-blue to-eu-blue-vivid flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground mb-4 font-semibold uppercase tracking-wider">{t('ask.try')}</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(q)}
                  className="text-sm px-4 py-2.5 bg-white dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 rounded-full text-gray-600 dark:text-slate-300 hover:border-eu-blue-vivid hover:text-eu-blue hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-all hover:shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className={`${hasConversation ? 'flex-1' : ''} space-y-4 mb-6`}>
          {conversation.map((item, index) => (
            <div key={index} className="space-y-3 animate-slide-up" style={{ animationDelay: `${index * 60}ms` }}>
              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-gradient-to-r from-eu-blue to-eu-blue-vivid text-white px-4 py-3 rounded-2xl rounded-br-sm max-w-[80%] sm:max-w-[65%] shadow-sm">
                  <p className="text-sm leading-relaxed">{item.q}</p>
                </div>
              </div>

              {/* AI message */}
              {(item.a || (index === conversation.length - 1 && streamingText)) && (
                <div className="flex justify-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-eu-blue to-eu-blue-vivid flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
                    </svg>
                  </div>
                  <div className="bg-white dark:bg-slate-900/75 border border-gray-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[80%] sm:max-w-[70%] shadow-sm">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-100">EU Hub AI</span>
                      <span className="text-xs text-gray-400 dark:text-slate-300">Mistral</span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {formatMessage(item.a || streamingText)}
                      {!item.a && streamingText && (
                        <span className="inline-block w-1.5 h-4 bg-eu-blue-vivid rounded-full ml-0.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && !streamingText && conversation[conversation.length - 1]?.a === '' && (
            <div className="flex justify-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-eu-blue to-eu-blue-vivid flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
                </svg>
              </div>
              <div className="bg-white dark:bg-slate-900/75 border border-gray-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div className="sticky bottom-20 md:bottom-4">
          <div className="glass rounded-2xl shadow-lg border border-white/20 p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('ask.placeholder')}
                className="flex-1 px-4 py-3 bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-eu-blue-vivid/50 focus:border-eu-blue-vivid outline-none transition-all text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="bg-gradient-to-r from-eu-blue to-eu-blue-vivid hover:shadow-lg hover:shadow-blue-500/25 text-white font-medium px-5 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatMessage(text: string): React.ReactNode {
  if (!text) return null;

  // Split into paragraphs
  const paragraphs = text.split('\n\n');

  return paragraphs.map((p, i) => {
    // Handle lists
    const lines = p.split('\n');
    const isList = lines.every(l => l.trim().startsWith('- ') || l.trim() === '');

    if (isList) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1 my-2">
          {lines.filter(l => l.trim()).map((l, j) => (
            <li key={j} className="text-sm">{formatInline(l.replace(/^-\s*/, ''))}</li>
          ))}
        </ul>
      );
    }

    return <p key={i} className={i > 0 ? 'mt-3' : ''}>{formatInline(p)}</p>;
  });
}

function formatInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
