import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { visit } from './visit.js';

// Allow the classes/attributes our pipeline adds on top of GitHub's schema.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [['id']],
    h2: [['id']],
    h3: [['id']],
    h4: [['id']],
    h5: [['id']],
    h6: [['id']],
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    span: [...(defaultSchema.attributes?.span || []), ['className']],
    div: [...(defaultSchema.attributes?.div || []), ['className']],
    li: [...(defaultSchema.attributes?.li || []), ['className']],
    input: [
      ...(defaultSchema.attributes?.input || []),
      ['type'],
      ['checked'],
      ['disabled'],
    ],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'input'],
};

// Turn `> [!NOTE]` blockquotes into labeled callout divs.
const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'];
function transformAlerts(tree) {
  visit(tree, 'element', (node) => {
    if (node.tagName !== 'blockquote') return;
    const firstP = node.children.find((c) => c.type === 'element' && c.tagName === 'p');
    if (!firstP) return;
    const firstText = firstP.children[0];
    if (!firstText || firstText.type !== 'text') return;

    const match = firstText.value.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
    if (!match) return;

    const kind = match[1].toLowerCase();
    if (!ALERT_TYPES.includes(kind)) return;

    firstText.value = firstText.value.slice(match[0].length);
    if (firstText.value === '' && firstP.children.length > 1) {
      firstP.children.shift();
    }

    node.tagName = 'div';
    node.properties = { className: [`md-alert`, `md-alert-${kind}`] };
    node.children = [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['md-alert-title'] },
        children: [{ type: 'text', value: kind }],
      },
      ...node.children,
    ];
  });
}

function alertPlugin() {
  return (tree) => {
    transformAlerts(tree);
  };
}

// Wrap each code block with a language label + copy button (click handled
// via delegation in useCodeCopy). Runs after highlight so <code> is intact.
function codeBlockPlugin() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'pre') return;
      if (node.__wrapped) return;

      const code = node.children?.find(
        (c) => c.type === 'element' && c.tagName === 'code'
      );
      let lang = '';
      const classes = code?.properties?.className || [];
      for (const cls of classes) {
        const m = /^language-([\w+#-]+)$/.exec(cls);
        if (m) {
          lang = m[1];
          break;
        }
      }

      const original = { ...node, __wrapped: true };
      node.tagName = 'div';
      node.properties = { className: ['code-block'] };
      node.children = [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-block-head'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['code-lang'] },
              children: [{ type: 'text', value: lang || 'text' }],
            },
            {
              type: 'element',
              tagName: 'button',
              properties: {
                type: 'button',
                className: ['code-copy'],
                'aria-label': 'Copy code to clipboard',
              },
              children: [{ type: 'text', value: 'Copy' }],
            },
          ],
        },
        original,
      ];
    });
  };
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function textContent(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textContent).join('');
}

function slugify(text, seen) {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  if (!slug) slug = 'section';
  let unique = slug;
  let i = 1;
  while (seen.has(unique)) unique = `${slug}-${i++}`;
  seen.add(unique);
  return unique;
}

// Slug-based heading ids, matching markdownStats.extractOutline so the TOC lands.
function headingIdsPlugin() {
  return (tree) => {
    const seen = new Set();
    visit(tree, 'element', (node) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      const id = slugify(textContent(node), seen);
      node.properties = { ...node.properties, id };
    });
  };
}

// remark-math only renders `$$` as display math when the delimiters are on
// their own lines, so promote single-line `$$…$$` to block form (skip fences).
function promoteDisplayMath(markdown) {
  const lines = String(markdown ?? '').split('\n');
  let inFence = false;
  let fenceMarker = null;
  const out = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
      }
      out.push(line);
      continue;
    }

    if (!inFence) {
      const m = line.match(/^(\s*)\$\$(.+?)\$\$\s*$/);
      if (m && !m[2].includes('$$')) {
        out.push(`${m[1]}$$`, m[2].trim(), '$$');
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

let processor = null;
function getProcessor() {
  if (!processor) {
    processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: false })
      .use(alertPlugin)
      .use(rehypeSanitize, schema)
      // After sanitize: it prefixes ids with `user-content-`, which would break
      // the TOC anchors and scroll-spy that rely on the bare slug.
      .use(headingIdsPlugin)
      // After sanitize: KaTeX reads only surviving math text and emits its own
      // escaped markup. Invalid LaTeX renders red rather than throwing.
      .use(rehypeKatex, { throwOnError: false, errorColor: '#dc2626', strict: 'ignore' })
      .use(rehypeHighlight, { detect: false, ignoreMissing: true })
      .use(codeBlockPlugin)
      .use(rehypeStringify);
  }
  return processor;
}

// Sanitized HTML from raw markdown. Never throws — falls back to escaped text.
export function markdownToHtml(markdown) {
  try {
    const file = getProcessor().processSync(promoteDisplayMath(markdown ?? ''));
    return String(file);
  } catch {
    const escaped = String(markdown ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="fallback-raw">${escaped}</pre>`;
  }
}