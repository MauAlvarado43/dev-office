const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
function uri(value) {
  const parsed = new URL(value);
  return {
    scheme: parsed.protocol.slice(0, -1), path: parsed.pathname,
    query: parsed.search.slice(1), fragment: parsed.hash.slice(1),
    with(changes) { return { ...this, ...changes }; }
  };
}
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === 'vscode') return { Uri: { parse: uri, joinPath: (base, ...parts) => base.with({ path: path.posix.join(base.path, ...parts) }) } };
  return originalLoad.call(this, id, ...args);
};
const { resolveLink } = require('../src/presentation/host/office-viewer-provider');
const { getShellHtml } = require('../src/presentation/host/webviews');
Module._load = originalLoad;

test('Resuelve enlaces locales relativos, espacios, fragmentos y archivos remotos', () => {
  const source = uri('file:///workspace/docs/informe.docx');
  assert.deepEqual({ ...resolveLink('../anexos/gu%C3%ADa.pdf#page=2', source), with: null }, {
    scheme: 'file', path: '/workspace/anexos/guía.pdf', query: '', fragment: 'page=2', with: null
  });
  assert.equal(resolveLink('./anexo.pdf', source).path, '/workspace/docs/anexo.pdf');
  assert.equal(resolveLink('file:///tmp/anexo.pdf', source).path, '/tmp/anexo.pdf');
  const remote = { ...source, scheme: 'vscode-remote' };
  assert.equal(resolveLink('../anexo.pdf', remote).scheme, 'vscode-remote');
  assert.equal(resolveLink('https://example.com/a?q=1#intro', source).scheme, 'https');
  assert.equal(resolveLink('mailto:hello@example.com', source).scheme, 'mailto');
});
test('No permite ejecutar comandos ni scripts desde los documentos', () => {
  const source = uri('file:///workspace/informe.docx');
  for (const href of ['command:workbench.action.closeWindow', 'javascript:alert(1)', 'data:text/html,test', '//example.com', '', '#intro', '\u0000test']) {
    assert.equal(resolveLink(href, source), null, href);
  }
});
test('El shell arranca sin importar PDF.js y permite sus módulos y WASM locales', () => {
  const html = getShellHtml({ extensionUri: uri('file:///extension') }, {
    cspSource: 'https://webview.example', asWebviewUri: (resource) => `https://webview.example${resource.path}`
  });
  assert.match(html, /script-src https:\/\/webview.example 'nonce-/);
  assert.match(html, /'wasm-unsafe-eval'/);
  assert.match(html, /src="https:\/\/webview.example\/extension\/dist\/webview.js"/);
  assert.doesNotMatch(html, /import \* as pdfjsLib/);
  assert.match(html, /id="search-input"/);
});
