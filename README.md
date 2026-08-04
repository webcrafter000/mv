# Fieldnote — Markdown Viewer

Upload a `.md` file, read it as a clean rendered document, and copy it out as
rich text that pastes well into Word, Google Docs, or Slack.

Built for reading the kind of markdown AI models produce: technical docs with
tables, code, LaTeX math, task lists, and GitHub-style callouts.

## Feature highlights

- **Full GFM** — headings, lists (nested, ordered, task), tables with column
  alignment, blockquotes, inline/fenced code, bold/italic/strikethrough,
  autolinks.
- **LaTeX math** — inline `$…$` and display `$$…$$` rendered with KaTeX.
  Single-line `$$…$$` is auto-promoted to a centered display equation.
- **GitHub alert callouts** — `> [!NOTE]`, `[!WARNING]`, `[!TIP]`, etc.
- **One-click rich copy** — HTML + plain text + original markdown to the
  clipboard in a single write; paste targets pick the richest format.
- **Per-code-block copy** with an auto-detected language label.
- **Light / dark theme** — follows the OS by default, togglable, remembered.
- **Auto-generated outline** with scroll-spy (active section highlights as you
  read) and a reading-progress bar. Collapses into a drawer on mobile.
- **Resilient** — malformed markdown never crashes the app; uploaded HTML is
  inert by construction.

## Setup

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
npm run preview  # serve the production build locally
```

Requires Node 18+. No environment variables, no backend — everything runs in
the browser.

## Design decisions

**Reading pane over split-view.** Most tools that render markdown default to
a side-by-side raw/rendered split. I skipped that: the target user (someone
checking an AI-generated doc) wants to *read* the document, not compare it
to its source. The raw source is one click away conceptually but not
fighting for screen space by default.

**Type pairing: serif body, mono chrome.** Rendered prose uses Source Serif
4 for long-form readability; UI chrome (top bar, sidebar, buttons, stats)
uses JetBrains Mono to read as a developer tool rather than a generic blog
theme. The two together are the main visual identity decision.

**Sidebar = outline + stats, not raw file browser.** Since only one file is
open at a time, a generic file-tree sidebar would be decorative. Instead the
sidebar auto-generates a clickable table of contents from headings, plus a
small stats readout (word count, reading time, line count) — both derived
from the actual document and both useful for someone skimming an AI-written
report before reading it in full.

**One rendering pipeline, used twice.** A single `unified` pipeline
(`remark-parse` → `remark-gfm` → `remark-math` → `remark-rehype` → alerts →
sanitize → heading IDs → `rehype-katex` → `rehype-highlight` → code-block
decoration → `rehype-stringify`) produces the HTML for both the on-screen
render and the clipboard's `text/html` payload. This was a deliberate choice
over using `react-markdown` for the screen and a separate converter for copy:
it guarantees what you copy is exactly what you saw, and it's one thing to
test instead of two. Stage order matters: heading IDs and KaTeX both run
*after* sanitize so the sanitizer's id-prefixing doesn't break TOC anchors,
and so KaTeX's own markup doesn't need to be whitelisted.

**GitHub-style alert callouts** (`> [!NOTE]`, `[!WARNING]`, etc.) are
supported since they show up constantly in AI-generated docs (see the
sample file) even though they're not in the core GFM spec.

**Math is first-class.** AI output leans heavily on LaTeX, so `remark-math`
+ `rehype-katex` are wired into the same pipeline. KaTeX runs *after*
sanitization (it only reads the math text that survived and emits its own
escaped markup), and renders invalid LaTeX in red rather than throwing —
consistent with the app's never-crash posture. One quirk worth calling out:
`remark-math` only treats `$$` as *display* math when the delimiters are on
their own lines, so a small pre-pass promotes single-line `$$…$$` (very
common in AI output) to block form, skipping anything inside code fences.

**Theming via CSS variables.** The rendered document reads all of its colors
from custom properties, so light/dark is a single class on `<html>` rather
than a duplicated stylesheet. The choice follows the OS preference until the
user makes an explicit one, then persists. A tiny inline script in
`index.html` applies the saved theme before first paint to avoid a flash.

## Markdown handling

- Parser: `remark-parse` + `remark-gfm` (tables, strikethrough, task lists,
  autolinks) + `remark-math` (inline and display LaTeX).
- Sanitization: `rehype-sanitize` with an extended GitHub schema (allows
  task-list checkboxes and syntax-highlight classes, nothing else beyond
  the default). Raw HTML embedded in the markdown source is not passed
  through (`allowDangerousHtml: false`), so `<script>` or `onerror=`
  payloads in an uploaded file are inert by construction, not just
  filtered after the fact.
- Malformed input: the pipeline never throws — `markdownToHtml` wraps
  processing in a try/catch and falls back to escaped preformatted text on
  a hard failure. React-level failures are additionally caught by an
  `ErrorBoundary` around the render so one bad file can't blank the app.
  I stress-tested against `src/fixtures/torture-test.md` (reachable from the
  empty state via "a stress test"): unclosed code fences,
  broken tables, dangling link syntax, unterminated bold markers, and
  content after an unclosed fence. None of these crash the app; the parser
  (`remark`, CommonMark-compliant) resolves most of them the way GitHub
  itself would.

## Copy button

One button, `navigator.clipboard.write()` with a multi-format
`ClipboardItem`:

- `text/html` — the rendered HTML with every element's styling inlined
  (`utils/htmlInliner.js`). Inlining matters because paste targets don't
  carry external stylesheets; without it, Word/Docs would receive bare,
  unstyled tags.
- `text/plain` — walked from the same rendered HTML (`utils/htmlToPlainText.js`),
  preserving block structure: blank lines between paragraphs, `- ` / `1. `
  list markers, `> ` quote prefixes, `text (url)` for links.
- `text/markdown` — the original source, written opportunistically inside
  its own try/catch. Browser support for arbitrary clipboard MIME types is
  inconsistent (Chrome/Edge generally accept it via `ClipboardItem`, other
  browsers may reject the whole write if it's included), so it's attempted
  first and silently dropped from the payload if the browser rejects it —
  the HTML and plain-text formats always still go through.
- Fallback chain: if `ClipboardItem`/`navigator.clipboard.write` isn't
  available at all, falls back to `writeText(plainText)`, and finally to a
  hidden-textarea `execCommand('copy')` for very old environments.

Both copy paths share a `prepareCopyContainer` step (`utils/copyPrep.js`) that
(1) strips the on-screen code-block chrome — the language label and per-block
Copy button are interface, not content, and must not paste into Word — and
(2) replaces rendered KaTeX with its original TeX source, since copying
KaTeX's dual MathML+HTML output verbatim produces duplicated, garbled text.

Each code block also has its **own** Copy button that lifts just that block's
source (delegated through a single click handler on the document container,
since the rendered doc is injected HTML rather than React components).

Tested by pasting into Google Docs, Word Online, plain-text fields, and
Slack's message composer.

## Accessibility & responsiveness

- Visible focus rings globally (`:focus-visible`), not just on inputs, and
  tuned for both themes.
- `prefers-reduced-motion` respected — animations (fade-in on render, the
  progress bar) are disabled for users who've opted out.
- Icon-only controls (copy, theme toggle, sidebar/menu toggles) have explicit
  `aria-label`s; the active outline entry carries `aria-current`.
- Upload zone is a real `<label>`/`<input type="file">` pair, keyboard-
  reachable and screen-reader-announced, not a `div` with a click handler.
- **Mobile:** the outline becomes a slide-over drawer (`role="dialog"`,
  `aria-modal`, closes on Escape or backdrop tap) instead of vanishing. Wide
  tables and code blocks scroll inside their own container, so the page body
  never scrolls sideways on a phone.
- Theme respects `prefers-color-scheme` and exposes `color-scheme` so native
  form controls and scrollbars match.

## Known limitations / what I'd improve with more time

- **Syntax-highlight colors don't survive copy.** The clipboard HTML inlines
  layout/color styling per tag, but not the individual `hljs-*` token
  colors inside code blocks — a pasted code block is monochrome. Would
  extend `htmlInliner.js` to also inline computed styles for highlight
  spans.
- **Bundle size.** highlight.js's common-language grammars plus KaTeX push the
  JS bundle to ~800 KB (~245 KB gzipped). Fine for a desktop tool, but I'd
  code-split KaTeX and lazy-load highlight grammars on demand before calling
  it done.
- **Inline `$…$` vs. currency.** Enabling inline math means `$5 … $10` in
  prose can occasionally be read as an equation. I kept inline math on because
  it's common and intentional in AI output; a heuristic (ignore `$` followed
  by a digit-and-space) would remove most false positives.
- **`text/markdown` clipboard support is unverified across all browsers** —
  by spec this format isn't part of the standard clipboard allow-list, so
  it works where the browser permits it and degrades silently elsewhere,
  per the assignment's own wording. Would add an explicit fallback affordance
  (e.g., a small "Markdown copied separately" toast) if a browser rejects it.
- **No automated test suite.** Given the time box I relied on the
  torture-test fixture and manual testing against Word/Docs/Slack rather
  than writing React Testing Library specs. That fixture would be the
  starting point for real tests.
- **Large files (multi-MB)** are capped at 8MB client-side but I haven't
  profiled rendering performance beyond that; very large tables in
  particular could get slow since the table isn't virtualized.
- **No persistent history** — only one file is ever "open," by design per
  the spec, but a small recent-files list (session-only, no backend) would
  be a natural next step.
