# Fieldnote — Markdown Viewer

<img width="1894" height="837" alt="image" src="https://github.com/user-attachments/assets/9f876480-3c5b-4266-b2eb-bfe3ca155fea" />

<img width="1913" height="851" alt="image" src="https://github.com/user-attachments/assets/7fecc51c-6f16-4501-afe0-f0d4eb4a6a5e" />

<img width="1919" height="849" alt="image" src="https://github.com/user-attachments/assets/6f7f1a3f-fdfc-4b3b-a1a0-32b65de86a07" />



Drop in a `.md` file, get a clean rendered doc. Copy it as rich text that actually pastes nicely into Word, Google Docs, or Slack.

Built for the markdown AI spits out: tables, code blocks, LaTeX math, task lists, GitHub callouts. The stuff that usually breaks when you copy-paste.

## What it does

- **Full GFM** — headings, nested lists, task lists, tables with alignment, blockquotes, code (inline + fenced), bold/italic/strikethrough, autolinks
- **LaTeX math** — inline `$...$` and display `$$...$$` via KaTeX. Single-line `$$` gets promoted to centered display automatically
- **GitHub alerts** — `> [!NOTE]`, `[!WARNING]`, `[!TIP]`, all that
- **One-click copy** — pushes HTML + plain text + markdown to clipboard in one go. Paste targets pick the richest format they support
- **Per-block copy** — each code block gets its own copy button with language label
- **Dark/light theme** — follows OS, togglable, remembers your choice
- **Auto TOC** — headings become a clickable outline with scroll-spy and reading progress. Collapses to drawer on mobile
- **Bulletproof** — malformed markdown won't crash. Uploaded HTML is inert by construction

## Quick start

```bash
npm install
npm run dev      # local dev
npm run build    # dist/
npm run preview  # serve build locally
```

Node 18+. No env vars, no backend — all browser.

## Design choices

**Reading pane only.** No split view. You're here to *read* the doc, not diff it against source. Raw markdown is accessible but not fighting for space.

**Serif body + mono chrome.** Source Serif 4 for the prose (readability), JetBrains Mono for UI chrome (tool feel). That's the whole visual identity.

**Sidebar = outline + stats.** Only one file open at a time, so a file-tree would be decorative. Instead you get clickable TOC + word count, reading time, line count. Actually useful for skimming AI reports.

**One pipeline, two uses.** `unified` chain produces HTML for both screen and clipboard copy. What you copy is exactly what you see. One thing to test instead of two. Order matters: heading IDs + KaTeX run *after* sanitization so TOC anchors don't break, and KaTeX markup doesn't need whitelisting.

**Math first-class.** AI output loves LaTeX. `remark-math` + `rehype-katex` in the pipeline. KaTeX runs post-sanitization, renders invalid LaTeX in red (never crashes). One quirk: `remark-math` only treats `$$` as display when on their own lines, so we pre-pass to promote single-line `$$...$$` (common in AI output) to block form.

**Theming via CSS variables.** Document colors come from custom properties. Light/dark is one class on `<html>`. Follows OS until user overrides, then persists. Inline script in `index.html` applies saved theme before first paint — no flash.

## Markdown handling

- Parser: `remark-parse` + `remark-gfm` (tables, strikethrough, task lists, autolinks) + `remark-math`
- Sanitization: `rehype-sanitize` with extended GitHub schema. Raw HTML doesn't pass through (`allowDangerousHtml: false`). `<script>` or `onerror=` payloads are inert by construction.
- Malformed input: pipeline never throws. `markdownToHtml` wraps everything in try/catch, falls back to escaped preformatted text on hard failure. `ErrorBoundary` catches React-level failures. Tested against `src/fixtures/torture-test.md` — unclosed fences, broken tables, dangling syntax, unterminated markers. None crash.

## Copy behavior

Single button using `navigator.clipboard.write()` with multi-format `ClipboardItem`:

- `text/html` — rendered HTML with every style inlined (paste targets don't carry external stylesheets)
- `text/plain` — walked from same HTML, preserving block structure, list markers, quote prefixes, link text
- `text/markdown` — original source (opportunistic; browsers may reject, we silently drop it and still deliver HTML + plain)

Fallbacks: `writeText(plainText)` → hidden-textarea `execCommand('copy')`.

Both copy paths run through `prepareCopyContainer`: strips code-block chrome (labels + copy buttons), replaces rendered KaTeX with original TeX source (copying KaTeX's dual MathML+HTML output produces garbled text).

Each code block has its own copy button too — delegates through a single click handler on the container.

Tested against Google Docs, Word Online, plain fields, Slack.

## Accessibility & responsiveness

- Visible focus rings everywhere, tuned for both themes
- `prefers-reduced-motion` respected — animations disabled
- Icon-only controls have explicit `aria-label`s; active outline entry gets `aria-current`
- Upload zone is a real `<label>`/`<input>` pair — keyboard-reachable, screen-reader-announced
- Mobile: outline becomes slide-over drawer (`role="dialog"`, `aria-modal`, Escape/backdrop closes). Wide tables + code blocks scroll inside container — page never scrolls sideways on phone
- `color-scheme` set so native controls + scrollbars match theme

## What I'd do with more time

- **Syntax colors don't survive copy.** Clipboard HTML inlines layout styles but not `hljs-*` token colors. Pasted code blocks are monochrome. Would extend `htmlInliner.js` to inline computed styles for highlight spans.
- **Bundle size.** highlight.js + KaTeX push JS to ~800 KB (~245 KB gzipped). Fine for desktop, but I'd code-split KaTeX + lazy-load highlight grammars.
- **Inline `$` vs. currency.** Enabling inline math means `$5 ... $10` in prose can get read as equations. Kept it on because it's intentional in AI output. A heuristic (ignore `$` followed by digit+space) would fix most false positives.
- **`text/markdown` clipboard support is spotty.** Works where browsers permit, degrades silently elsewhere. Would add a "Markdown copied separately" toast on rejection.
- **No automated test suite.** Relied on torture-test fixture + manual testing against Word/Docs/Slack. That fixture would be the starting point for real tests.
- **Large files (multi-MB)** capped at 8MB client-side. Haven't profiled beyond that — very large tables could get slow (not virtualized).
- **No persistent history.** Only one file "open" by design, but a session-only recent-files list would be a natural next step.
