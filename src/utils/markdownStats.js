const WORDS_PER_MINUTE = 220;

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
  while (seen.has(unique)) {
    unique = `${slug}-${i++}`;
  }
  seen.add(unique);
  return unique;
}

// ATX headings for the outline, skipping anything inside fenced code blocks.
export function extractOutline(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const outline = [];
  const seen = new Set();
  let inFence = false;
  let fenceMarker = null;

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
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const depth = heading[1].length;
      // Flatten inline markdown so the label/slug match the rendered heading.
      const text = heading[2]
        .trim()
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      outline.push({ depth, text, id: slugify(text, seen) });
    }
  }
  return outline;
}

// Rough word count / reading time, stripping the noisiest markup first.
export function computeStats(markdown) {
  const raw = String(markdown ?? '');
  const stripped = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]/g, ' ');

  const words = stripped.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const lines = raw.split('\n').length;

  return { words, minutes, lines, chars: raw.length };
}
