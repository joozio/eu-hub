'use client';

import { useState } from 'react';

interface ShareButtonProps {
  title: string;
  text?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function ShareButton({ title, text, className = '', size = 'md' }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'shared'>('idle');

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';

    if (navigator.share) {
      try {
        await navigator.share({ title, text: text || title, url });
        setState('shared');
        setTimeout(() => setState('idle'), 2000);
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setState('copied');
        setTimeout(() => setState('idle'), 2000);
      } catch {
        // Clipboard not available
      }
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs gap-1.5'
    : 'px-3 py-2 text-sm gap-2';

  return (
    <button
      onClick={handleShare}
      aria-label="Share this page"
      className={`inline-flex items-center font-medium rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition-all ${sizeClasses} ${className}`}
    >
      {state === 'copied' ? (
        <>
          <CheckIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Link copied
        </>
      ) : state === 'shared' ? (
        <>
          <CheckIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Shared!
        </>
      ) : (
        <>
          <ShareIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Share
        </>
      )}
    </button>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
