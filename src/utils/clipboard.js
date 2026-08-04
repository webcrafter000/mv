import { buildClipboardHtml } from './htmlInliner.js';
import { htmlToPlainText } from './htmlToPlainText.js';

// Single multi-format clipboard write (HTML + plain text + original markdown
// where supported); paste targets pick the richest format they understand.
export async function copyRenderedMarkdown(renderedHtml, rawMarkdown) {
  const styledHtml = buildClipboardHtml(renderedHtml);
  const plainText = htmlToPlainText(renderedHtml);

  if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
    try {
      const data = {
        'text/html': new Blob([styledHtml], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      };

      // text/markdown isn't on every browser's allow-list, so try it, then
      // retry without it if the whole write is rejected.
      let includedMarkdown = false;
      try {
        data['text/markdown'] = new Blob([rawMarkdown ?? ''], { type: 'text/markdown' });
        await navigator.clipboard.write([new window.ClipboardItem(data)]);
        includedMarkdown = true;
      } catch {
        delete data['text/markdown'];
        await navigator.clipboard.write([new window.ClipboardItem(data)]);
      }

      return { ok: true, mode: includedMarkdown ? 'html+text+markdown' : 'html+text' };
    } catch {
      // fall through to plain-text path
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plainText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = plainText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    return { ok: true, mode: 'text-only' };
  } catch {
    return { ok: false, mode: 'none' };
  }
}
