import React from 'react';

export function Sidebar({ outline, stats, activeId, onNavigate, className = '' }) {
  return (
    <aside className={`flex flex-col font-mono text-xs ${className}`}>
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <p className="mb-3 uppercase tracking-wide text-slate-650/70 dark:text-zinc-500">
          Outline
        </p>
        {outline.length === 0 ? (
          <p className="text-slate-650/60 dark:text-zinc-500">No headings found</p>
        ) : (
          <nav className="space-y-0.5">
            {outline.map((item) => {
              const isActive = item.id === activeId;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={onNavigate}
                  aria-current={isActive ? 'location' : undefined}
                  className={`block truncate rounded px-2 py-1 no-underline transition-colors ${
                    isActive
                      ? 'bg-signal-soft font-medium text-signal dark:bg-signal/15 dark:text-signal'
                      : 'text-slate-650 hover:bg-ink/5 hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100'
                  }`}
                  style={{ paddingLeft: `${(item.depth - 1) * 12 + 8}px` }}
                  title={item.text}
                >
                  {item.text}
                </a>
              );
            })}
          </nav>
        )}
      </div>

      <div className="border-t border-line px-5 py-4 dark:border-[#22242b]">
        <p className="mb-2 uppercase tracking-wide text-slate-650/70 dark:text-zinc-500">
          Document
        </p>
        <dl className="space-y-1 text-slate-650 dark:text-zinc-400">
          <div className="flex justify-between">
            <dt>Words</dt>
            <dd className="text-ink dark:text-zinc-200">{stats.words.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Reading time</dt>
            <dd className="text-ink dark:text-zinc-200">{stats.minutes} min</dd>
          </div>
          <div className="flex justify-between">
            <dt>Lines</dt>
            <dd className="text-ink dark:text-zinc-200">{stats.lines.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Headings</dt>
            <dd className="text-ink dark:text-zinc-200">{outline.length}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
