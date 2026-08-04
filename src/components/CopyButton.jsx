import React, { useState } from 'react';
import { Check, Copy, AlertTriangle } from 'lucide-react';
import { copyRenderedMarkdown } from '../utils/clipboard.js';

const RESET_DELAY = 2200;

export function CopyButton({ html, markdown, disabled }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed

  const handleClick = async () => {
    if (disabled) return;
    const result = await copyRenderedMarkdown(html, markdown);
    setStatus(result.ok ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), RESET_DELAY);
  };

  const label =
    status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Copy rendered document to clipboard as rich text"
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
        status === 'copied'
          ? 'border-green-600/30 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400'
          : status === 'failed'
            ? 'border-red-600/30 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
            : 'border-line bg-white text-ink hover:border-ink/30 hover:bg-ink/[0.03] dark:border-[#2a2c33] dark:bg-transparent dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-white/5'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {status === 'copied' ? (
        <Check size={14} strokeWidth={2} />
      ) : status === 'failed' ? (
        <AlertTriangle size={14} strokeWidth={2} />
      ) : (
        <Copy size={14} strokeWidth={2} />
      )}
      {label}
    </button>
  );
}
