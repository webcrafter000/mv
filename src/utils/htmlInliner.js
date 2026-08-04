import { prepareCopyContainer } from './copyPrep.js';

// Per-tag inline styles — kept simple since Word/Docs only honor a modest
// subset of CSS on paste.
const RULES = {
  h1: 'font-family:Georgia,serif;font-size:26px;font-weight:700;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #e4e4e7;color:#101114;',
  h2: 'font-family:Georgia,serif;font-size:21px;font-weight:700;margin:22px 0 6px;color:#101114;',
  h3: 'font-family:Georgia,serif;font-size:18px;font-weight:700;margin:18px 0 6px;color:#101114;',
  h4: 'font-family:Georgia,serif;font-size:15px;font-weight:700;margin:16px 0 6px;color:#101114;text-transform:uppercase;letter-spacing:0.03em;',
  h5: 'font-family:Georgia,serif;font-size:14px;font-weight:700;margin:14px 0 6px;color:#101114;',
  h6: 'font-family:Georgia,serif;font-size:13px;font-weight:700;margin:14px 0 6px;color:#4b4c53;',
  p: 'margin:10px 0;line-height:1.6;',
  a: 'color:#2452ff;text-decoration:underline;',
  strong: 'font-weight:700;',
  em: 'font-style:italic;',
  del: 'text-decoration:line-through;color:#71717a;',
  blockquote:
    'margin:12px 0;padding:8px 14px;border-left:3px solid #2452ff;background:#f7f8fc;color:#33343a;font-style:italic;',
  ul: 'margin:10px 0;padding-left:28px;',
  ol: 'margin:10px 0;padding-left:28px;',
  li: 'margin:4px 0;line-height:1.6;',
  code: 'font-family:"Courier New",monospace;font-size:0.9em;background:#f1f1f4;border:1px solid #e4e4e7;padding:1px 5px;border-radius:3px;color:#b3261e;',
  pre: 'font-family:"Courier New",monospace;font-size:0.85em;line-height:1.5;color:#e4e4e7;padding:0;margin:0;',
  preWrapper: 'background:#16171b;padding:12px 14px;border-radius:6px;border:1px solid #1a1a1f;overflow-x:auto;margin:12px 0;display:block;',
  hr: 'border:none;border-top:1px solid #d4d4d8;margin:20px 0;',
  table: 'border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;',
  th: 'border:1px solid #d4d4d8;padding:6px 10px;text-align:left;background:#f4f4f5;font-weight:700;',
  td: 'border:1px solid #d4d4d8;padding:6px 10px;text-align:left;vertical-align:top;',
  img: 'max-width:100%;border-radius:4px;border:1px solid #e4e4e7;',
};

function inlineStyles(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const nodesToProcess = [];
  let current = root.nodeType === 1 ? root : walker.nextNode();
  while (current) {
    nodesToProcess.push(current);
    current = walker.nextNode();
  }

  // Reverse order so element replacements don't disturb later indices.
  for (let i = nodesToProcess.length - 1; i >= 0; i--) {
    const node = nodesToProcess[i];
    const tag = node.tagName?.toLowerCase();

    // <del> -> <span> so Word doesn't treat it as a revision mark.
    if (tag === 'del') {
      const span = document.createElement('span');
      span.innerHTML = node.innerHTML;
      const existing = node.getAttribute('style') || '';
      span.setAttribute('style', existing + RULES['del']);
      node.replaceWith(span);
      continue;
    }
    
    // Wrap <pre> in a bg <div> — Word strips background on <pre> alone.
    if (tag === 'pre') {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('style', RULES['preWrapper']);
      const pre = node.cloneNode(true);
      const existing = pre.getAttribute('style') || '';
      pre.setAttribute('style', existing + RULES['pre']);
      wrapper.appendChild(pre);
      node.replaceWith(wrapper);
      continue;
    }
    
    if (tag === 'code' && node.parentElement?.tagName.toLowerCase() === 'pre') {
      node.removeAttribute('style');
    } else if (RULES[tag]) {
      const existing = node.getAttribute('style') || '';
      node.setAttribute('style', existing + RULES[tag]);
    }
  }
}

// Rendered HTML -> standalone string with per-element styles inlined, for
// the text/html clipboard entry.
export function buildClipboardHtml(renderedHtml) {
  const container = prepareCopyContainer(renderedHtml);
  inlineStyles(container);

  const wrapperStyle =
    'font-family:Georgia,serif;font-size:15px;line-height:1.65;color:#1c1d21;';
  return `<div style="${wrapperStyle}">${container.innerHTML}</div>`;
}