import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, PanelLeft, RotateCcw, Menu, X } from 'lucide-react';
import { FileUpload } from './components/FileUpload.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { CopyButton } from './components/CopyButton.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { markdownToHtml } from './utils/markdownProcessor.js';
import { extractOutline, computeStats } from './utils/markdownStats.js';
import { useTheme } from './hooks/useTheme.js';
import { useActiveHeading } from './hooks/useActiveHeading.js';
import { useCodeCopy } from './hooks/useCodeCopy.js';
import sampleMarkdown from './fixtures/design-review-sample.md?raw';
import tortureMarkdown from './fixtures/torture-test.md?raw';

export default function App() {
  const [doc, setDoc] = useState(null); // { name, markdown }
  const [uploadError, setUploadError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const { theme, toggle } = useTheme();
  // Callback-ref state so scroll-spy/progress effects re-bind once <main> mounts.
  const [scrollEl, setScrollEl] = useState(null);
  const docRef = useRef(null);

  const html = useMemo(() => (doc ? markdownToHtml(doc.markdown) : ''), [doc]);
  const outline = useMemo(() => (doc ? extractOutline(doc.markdown) : []), [doc]);
  const stats = useMemo(
    () => (doc ? computeStats(doc.markdown) : { words: 0, minutes: 0, lines: 0 }),
    [doc]
  );

  const activeId = useActiveHeading(scrollEl, outline);
  useCodeCopy(docRef, doc?.name);

  // Reading-progress bar.
  useEffect(() => {
    const el = scrollEl;
    if (!el || !doc) return undefined;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [doc, scrollEl]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  const handleFileLoaded = (markdown, name) => {
    setUploadError('');
    setDoc({ name, markdown });
    setMobileNavOpen(false);
    if (scrollEl) scrollEl.scrollTop = 0;
  };

  const handleReset = () => {
    setDoc(null);
    setUploadError('');
    setMobileNavOpen(false);
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-paper dark:bg-[#0e0f13]">
        <TopBar filename={null} theme={theme} onToggleTheme={toggle} />
        <FileUpload
          onFileLoaded={handleFileLoaded}
          error={uploadError}
          onError={setUploadError}
          samples={[
            {
              label: 'a sample document',
              onClick: () => handleFileLoaded(sampleMarkdown, 'design-review.md'),
            },
            {
              label: 'a stress test',
              onClick: () => handleFileLoaded(tortureMarkdown, 'torture-test.md'),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-paper dark:bg-[#0e0f13]">
      <TopBar
        filename={doc.name}
        onReset={handleReset}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        sidebarOpen={sidebarOpen}
        hasOutline={outline.length > 0}
        html={html}
        markdown={doc.markdown}
        theme={theme}
        onToggleTheme={toggle}
        progress={progress}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <Sidebar
            outline={outline}
            stats={stats}
            activeId={activeId}
            className="hidden w-64 shrink-0 border-r border-line bg-white/60 dark:border-[#22242b] dark:bg-white/[0.02] md:flex"
          />
        )}
        <main ref={setScrollEl} className="min-w-0 flex-1 overflow-y-auto">
          <ErrorBoundary resetKey={doc.name}>
            <div className="mx-auto max-w-prose px-6 py-12 sm:px-10">
              <div
                ref={docRef}
                className="doc animate-fade-in"
                // Sanitized upstream by rehype-sanitize in the pipeline.
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile outline drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Document outline"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl dark:bg-[#141519]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 dark:border-[#22242b]">
              <span className="font-mono text-xs uppercase tracking-wide text-slate-650 dark:text-zinc-400">
                Contents
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close outline"
                className="rounded-md p-1.5 text-slate-650 hover:bg-ink/5 hover:text-ink dark:text-zinc-400 dark:hover:bg-white/10"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <Sidebar
              outline={outline}
              stats={stats}
              activeId={activeId}
              onNavigate={() => setMobileNavOpen(false)}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({
  filename,
  onReset,
  onToggleSidebar,
  onOpenMobileNav,
  sidebarOpen,
  hasOutline,
  html,
  markdown,
  theme,
  onToggleTheme,
  progress = 0,
}) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-line bg-white px-4 dark:border-[#22242b] dark:bg-[#141519] sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {filename && hasOutline && (
          <>
            <button
              type="button"
              onClick={onOpenMobileNav}
              aria-label="Open outline"
              className="inline-flex rounded-md p-1.5 text-slate-650 transition-colors hover:bg-ink/5 hover:text-ink dark:text-zinc-400 dark:hover:bg-white/10 md:hidden"
            >
              <Menu size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Hide outline sidebar' : 'Show outline sidebar'}
              aria-pressed={sidebarOpen}
              className="hidden rounded-md p-1.5 text-slate-650 transition-colors hover:bg-ink/5 hover:text-ink dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 md:inline-flex"
            >
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          </>
        )}
        <div className="flex items-center gap-2">
          <FileText size={16} strokeWidth={1.75} className="shrink-0 text-signal" />
          <span className="truncate font-mono text-sm font-medium text-ink dark:text-zinc-100">
            {filename || 'Fieldnote'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        {filename && (
          <>
            <CopyButton html={html} markdown={markdown} disabled={!html} />
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 font-mono text-xs font-medium text-slate-650 transition-colors hover:border-ink/30 hover:text-ink dark:border-[#2a2c33] dark:bg-transparent dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              <RotateCcw size={13} strokeWidth={2} />
              <span className="hidden sm:inline">New file</span>
            </button>
          </>
        )}
      </div>

      {filename && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-signal transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
