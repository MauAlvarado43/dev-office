const vscode = require('vscode');
const crypto = require('node:crypto');

function getShellHtml(context, webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.css'));
    const viewerUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js'));
    const pdfUri = webview.asWebviewUri(vscode.Uri.joinPath(
      context.extensionUri, 'media', 'vendor', 'pdfjs', 'pdf.mjs'
    ));
    const workerUri = webview.asWebviewUri(vscode.Uri.joinPath(
      context.extensionUri, 'media', 'vendor', 'pdfjs', 'pdf.worker.mjs'
    ));
    const pdfAssetsUri = webview.asWebviewUri(vscode.Uri.joinPath(
      context.extensionUri, 'media', 'vendor', 'pdfjs'
    ));

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; worker-src ${webview.cspSource} blob:; connect-src ${webview.cspSource} blob:; font-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${cssUri}">
  <title>Office Viewer</title>
</head>
<body>
  <header class="toolbar" role="toolbar" aria-label="Controles del visor">
    <strong id="document-name" class="document-name">Office Viewer</strong>
    <span class="readonly-badge">Solo lectura</span>
    <span class="toolbar-spacer"></span>
    <div id="page-controls" class="control-group hidden">
      <button id="previous-page" title="Página anterior" aria-label="Página anterior">‹</button>
      <span id="page-label">1 / 1</span>
      <button id="next-page" title="Página siguiente" aria-label="Página siguiente">›</button>
    </div>
    <div class="control-group">
      <button id="zoom-out" title="Alejar" aria-label="Alejar">−</button>
      <span id="zoom-label">100%</span>
      <button id="zoom-in" title="Acercar" aria-label="Acercar">+</button>
    </div>
    <button id="reload" title="Actualizar" aria-label="Actualizar">↻</button>
  </header>
  <div id="notice" class="notice hidden"></div>
  <main id="viewport">
    <div id="loading" class="state-card"><span class="spinner"></span><span>Abriendo documento…</span></div>
    <div id="content" class="hidden"></div>
  </main>
  <script type="module" nonce="${nonce}">
    import * as pdfjsLib from '${pdfUri}';
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${workerUri}';
    globalThis.pdfjsLib = pdfjsLib;
    globalThis.pdfAssetBase = '${pdfAssetsUri}/';
    await import('${viewerUri}');
  </script>
</body>
</html>`;
  }
module.exports = { getShellHtml };
