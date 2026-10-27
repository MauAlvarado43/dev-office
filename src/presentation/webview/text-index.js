// Keep offsets aligned with PDF.js text items and separate HTML block boundaries.
export function textIndex(root) {
  let text = '';
  const nodes = [];
  const blocks = /^(P|DIV|H[1-6]|LI|TR|TD|TH|ARTICLE|SECTION|BLOCKQUOTE)$/;
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') text += '\n';
      else {
        for (const child of node.childNodes) visit(child);
        if (blocks.test(node.tagName)) text += '\n';
      }
    }
  }
  visit(root);
  return { text, nodes };
}

export function rangeFor(index, match) {
  const first = index.nodes.find((entry) => entry.end > match.start);
  const last = index.nodes.find((entry) => entry.start < match.end && entry.end >= match.end);
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, Math.max(0, match.start - first.start));
  range.setEnd(last.node, match.end - last.start);
  return range;
}
