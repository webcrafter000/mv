import { useEffect, useState } from 'react';

// Active outline heading = last one scrolled past the pane top. Uses a
// position scan (not IntersectionObserver) since headings can be sparse.
export function useActiveHeading(scrollRoot, outline) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!scrollRoot || !outline || outline.length === 0) {
      setActiveId('');
      return undefined;
    }

    const ids = outline.map((h) => h.id);
    const elements = () =>
      ids
        .map((id) => ({ id, el: scrollRoot.querySelector(`#${CSS.escape(id)}`) }))
        .filter((x) => x.el);

    let els = elements();
    let raf = 0;

    const update = () => {
      raf = 0;
      if (els.length === 0) els = elements();
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const ACTIVE_LINE = 100;

      let current = els[0]?.id || '';
      for (const { id, el } of els) {
        if (el.getBoundingClientRect().top - rootTop <= ACTIVE_LINE) current = id;
        else break;
      }

      // Force the last heading active at the very bottom.
      const atBottom =
        scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2;
      if (atBottom) current = els[els.length - 1]?.id || current;

      setActiveId((prev) => (prev === current ? prev : current));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scrollRoot.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRoot, outline]);

  return activeId;
}
