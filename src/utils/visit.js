// Minimal depth-first visitor for hast trees (avoids a unist-util-visit dep).
export function visit(tree, type, fn) {
  const callback = typeof type === 'function' ? type : fn;
  const targetType = typeof type === 'function' ? null : type;

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (targetType === null || node.type === targetType) {
      callback(node);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  }

  walk(tree);
}
