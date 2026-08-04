import React, { useCallback, useRef, useState } from 'react';
import { FileText, UploadCloud } from 'lucide-react';

const ACCEPTED_EXT = ['.md', '.markdown', '.mdx', '.mdown', '.mkd'];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export function FileUpload({ onFileLoaded, error, onError, samples = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;

      const lower = file.name.toLowerCase();
      const looksLikeMarkdown = ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
      if (!looksLikeMarkdown) {
        onError(`"${file.name}" doesn't look like a markdown file. Expected .md or .markdown.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        onError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 8MB.`);
        return;
      }
      if (file.size === 0) {
        onError(`"${file.name}" is empty — nothing to render.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        onFileLoaded(text, file.name);
      };
      reader.onerror = () => {
        onError(`Couldn't read "${file.name}". The file may be corrupted.`);
      };
      reader.readAsText(file);
    },
    [onFileLoaded, onError]
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white dark:border-[#2a2c33] dark:bg-white/[0.03]">
            <FileText size={20} strokeWidth={1.75} className="text-signal" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-zinc-100">
            Read a markdown file, cleanly
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-650 dark:text-zinc-400">
            Upload a .md file to render it as a formatted document, then copy
            it out as rich text for Word, Docs, or Slack.
          </p>
        </div>

        <label
          htmlFor="markdown-upload"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
            isDragging
              ? 'border-signal bg-signal-soft dark:bg-signal/10'
              : 'border-line bg-white hover:border-slate-650/40 dark:border-[#2a2c33] dark:bg-white/[0.02] dark:hover:border-zinc-500/50'
          }`}
        >
          <UploadCloud
            size={28}
            strokeWidth={1.5}
            className={isDragging ? 'text-signal' : 'text-slate-650/70 dark:text-zinc-500'}
          />
          <div>
            <p className="text-sm font-medium text-ink dark:text-zinc-200">
              Drop a markdown file here, or{' '}
              <span className="text-signal underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 font-mono text-xs text-slate-650/80 dark:text-zinc-500">
              .md · .markdown · up to 8MB
            </p>
          </div>
          <input
            id="markdown-upload"
            ref={inputRef}
            type="file"
            accept=".md,.markdown,.mdx,.mdown,.mkd,text/markdown,text/plain"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {samples.length > 0 && (
          <p className="mt-5 text-center text-xs text-slate-650/70 dark:text-zinc-500">
            No file handy? Load{' '}
            {samples.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span> or </span>}
                <button
                  type="button"
                  onClick={s.onClick}
                  className="text-signal underline underline-offset-2 hover:text-ink dark:hover:text-zinc-100"
                >
                  {s.label}
                </button>
              </React.Fragment>
            ))}
            .
          </p>
        )}
      </div>
    </div>
  );
}
