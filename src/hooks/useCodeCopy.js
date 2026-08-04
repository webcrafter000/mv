import { useEffect } from 'react';

// Clipboard API first; on absence OR rejection, fall back to execCommand.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// One delegated click handler for every code block's static Copy button
// (the doc is injected HTML, so per-block React components aren't an option).
export function useCodeCopy(containerRef, resetKey) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const timers = new Map();

    const onClick = async (e) => {
      const btn = e.target.closest('.code-copy');
      if (!btn || !container.contains(btn)) return;

      const block = btn.closest('.code-block');
      const pre = block?.querySelector('pre');
      const text = pre ? pre.innerText : '';
      if (!text) return;

      const ok = await copyText(text);

      btn.textContent = ok ? 'Copied' : 'Failed';
      btn.classList.toggle('is-copied', ok);
      clearTimeout(timers.get(btn));
      timers.set(
        btn,
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('is-copied');
        }, 1800)
      );
    };

    container.addEventListener('click', onClick);
    return () => {
      container.removeEventListener('click', onClick);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [containerRef, resetKey]);
}
