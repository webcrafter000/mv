import { prepareCopyContainer } from './copyPrep.js';

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'tr', 'table', 'ul', 'ol', 'hr', 'li',
]);

let orderedCounters = [];

function renderNode(node, out, listDepth) {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent.replace(/\s+/g, ' '));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();

  if (tag === 'br') {
    out.push('\n');
    return;
  }
  if (tag === 'hr') {
    out.push('\n\n---\n\n');
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    if (tag === 'ol') orderedCounters.push(1);
    node.childNodes.forEach((child) => renderNode(child, out, listDepth + 1));
    if (tag === 'ol') orderedCounters.pop();
    out.push('\n');
    return;
  }
  if (tag === 'li') {
    const indent = '  '.repeat(Math.max(0, listDepth - 1));
    const parentIsOrdered = node.parentElement?.tagName.toLowerCase() === 'ol';
    let marker = '- ';
    if (parentIsOrdered) {
      const i = orderedCounters.length - 1;
      marker = `${orderedCounters[i]}. `;
      orderedCounters[i] += 1;
    }
    out.push(`\n${indent}${marker}`);
    node.childNodes.forEach((child) => renderNode(child, out, listDepth));
    return;
  }
  if (tag === 'a') {
    const href = node.getAttribute('href');
    const text = node.textContent.trim();
    out.push(href && href !== text ? `${text} (${href})` : text);
    return;
  }
  if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') {
    out.push(`\`${node.textContent}\``);
    return;
  }
  if (tag === 'pre') {
    out.push(`\n\n${node.textContent.replace(/\n$/, '')}\n\n`);
    return;
  }
  if (tag === 'blockquote') {
    const inner = [];
    node.childNodes.forEach((child) => renderNode(child, inner, listDepth));
    const quoted = inner
      .join('')
      .trim()
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n');
    out.push(`\n\n${quoted}\n\n`);
    return;
  }
  if (tag === 'th' || tag === 'td') {
    out.push(`${node.textContent.trim()}\t`);
    return;
  }
  if (tag === 'tr') {
    node.childNodes.forEach((child) => renderNode(child, out, listDepth));
    out.push('\n');
    return;
  }

  node.childNodes.forEach((child) => renderNode(child, out, listDepth));
  if (BLOCK_TAGS.has(tag)) out.push('\n\n');
}

// Rendered HTML -> readable plain text (block spacing, list markers,
// "text (url)" links) for the text/plain clipboard entry.
export function htmlToPlainText(html) {
  const container = prepareCopyContainer(html);
  orderedCounters = [];
  const out = [];
  renderNode(container, out, 0);
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
