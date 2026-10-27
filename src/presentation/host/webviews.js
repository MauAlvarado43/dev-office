const vscode = require('vscode');
const crypto = require('node:crypto');

function getShellHtml(context, webview) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const resource = (...parts) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...parts));
  const pdfBase = resource('media', 'vendor', 'pdfjs');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'; worker-src ${webview.cspSource} blob:; connect-src ${webview.cspSource} blob:; font-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${resource('dist', 'webview.css')}">
  <title>Office Viewer</title>
</head>
<body data-pdf-base="${pdfBase}/">
  <header class="toolbar" role="toolbar" aria-label="Controles del visor">
    <button id="toggle-outline" class="hidden" title="Mostrar índice" aria-label="Mostrar índice" aria-expanded="false" aria-controls="outline">☰</button>
    <div class="document-title"><strong id="document-name">Office Viewer</strong><span id="document-format" class="document-format">Vista previa · Solo lectura</span></div>
    <span class="toolbar-spacer"></span>
    <button id="toggle-search" title="Buscar (Ctrl/Cmd+F)" aria-controls="search-bar" aria-expanded="false">Buscar</button>
    <div id="page-controls" class="control-group hidden">
      <button id="previous-page" title="Página anterior" aria-label="Página anterior">‹</button>
      <label for="page-number" class="sr-only">Página</label>
      <input id="page-number" type="number" min="1" value="1" aria-label="Ir a página">
      <span id="page-label">/ 1</span>
      <button id="next-page" title="Página siguiente" aria-label="Página siguiente">›</button>
    </div>
    <div class="control-group">
      <button id="zoom-out" title="Alejar" aria-label="Alejar">−</button>
      <button id="zoom-label" class="quiet" title="Restablecer zoom al 100%">100%</button>
      <button id="zoom-in" title="Acercar" aria-label="Acercar">+</button>
    </div>
    <button id="fit-width" class="quiet" title="Ajustar al ancho disponible">Ajustar ancho</button>
    <button id="open-external" class="quiet" title="Abrir el archivo con la aplicación predeterminada">Abrir externo ↗</button>
    <button id="reload" title="Actualizar" aria-label="Actualizar">↻</button>
  </header>
  <section id="search-bar" class="search-bar hidden" aria-label="Buscar en el documento">
    <label for="search-input" class="sr-only">Buscar texto</label>
    <input id="search-input" type="search" placeholder="Buscar en el documento…" autocomplete="off">
    <label class="case-option"><input id="match-case" type="checkbox"> Aa <span class="sr-only">Distinguir mayúsculas</span></label>
    <span id="search-status" role="status" aria-live="polite">Escribe para buscar</span>
    <button id="previous-match" title="Coincidencia anterior (Mayús+Enter)" aria-label="Coincidencia anterior" disabled>↑</button>
    <button id="next-match" title="Coincidencia siguiente (Enter)" aria-label="Coincidencia siguiente" disabled>↓</button>
    <button id="close-search" class="quiet" title="Cerrar búsqueda (Esc)" aria-label="Cerrar búsqueda">×</button>
  </section>
  <div id="notice" class="notice hidden" role="status"></div>
  <div class="workspace">
    <aside id="outline" class="outline hidden" aria-label="Índice del documento"><strong>Contenido</strong><nav id="outline-items"></nav></aside>
    <main id="viewport" tabindex="-1">
      <div id="loading" class="state-card" role="status"><span class="spinner"></span><span>Abriendo documento…</span></div>
      <div id="content" class="hidden"></div>
    </main>
  </div>
  <footer id="viewer-status" class="status-bar" role="status">Procesamiento local · Solo lectura</footer>
  <script type="module" nonce="${nonce}" src="${resource('dist', 'webview.js')}"></script>
</body>
</html>`;
}
module.exports = { getShellHtml };
