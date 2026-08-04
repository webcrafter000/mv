// Detached container of the rendered HTML, cleaned for the clipboard:
// drop the code-block chrome (label + Copy button) and swap rendered KaTeX
// back to its TeX source, so pasted output isn't polluted or garbled.
export function prepareCopyContainer(html) {
  const container = document.createElement('div');
  container.innerHTML = html || '';

  container.querySelectorAll('.code-block-head').forEach((el) => el.remove());

  container.querySelectorAll('.katex').forEach((el) => {
    // container is detached, so use contains() not isConnected.
    if (!container.contains(el)) return;
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    const src = (annotation ? annotation.textContent : el.textContent).trim();
    const display = !!el.closest('.katex-display');
    const text = display ? `\n$$${src}$$\n` : `$${src}$`;
    const target = el.closest('.katex-display') || el;
    target.replaceWith(document.createTextNode(text));
  });

  return container;
}
