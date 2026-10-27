// Literal search with flexible whitespace; offsets always refer to the original text.
function findMatches(text, query, caseSensitive = false) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return Array.from(text.matchAll(new RegExp(pattern, caseSensitive ? 'gu' : 'giu')),
    (match) => ({ start: match.index, end: match.index + match[0].length }));
}

module.exports = { findMatches };
