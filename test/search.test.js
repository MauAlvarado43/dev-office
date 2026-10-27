const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findMatches } = require('../src/core/search');

test('La búsqueda literal conserva offsets y permite espacios entre líneas', () => {
  const text = 'Plan de\n trabajo. PLAN DE trabajo.';
  const matches = findMatches(text, 'plan de trabajo');
  assert.deepEqual(matches.map(({ start, end }) => text.slice(start, end)), ['Plan de\n trabajo', 'PLAN DE trabajo']);
  assert.equal(findMatches(text, 'PLAN DE trabajo', true).length, 1);
  assert.equal(findMatches(text, 'plan de trabajo', true).length, 0);
});
test('La búsqueda trata metacaracteres como texto y maneja Unicode y consultas vacías', () => {
  assert.deepEqual(findMatches('a+b [1] aab', 'a+b'), [{ start: 0, end: 3 }]);
  assert.deepEqual(findMatches('ÁRBOL árbol', 'árbol'), [{ start: 0, end: 5 }, { start: 6, end: 11 }]);
  assert.deepEqual(findMatches('Texto', '   '), []);
  assert.deepEqual(findMatches('Texto', 'ausente'), []);
});
