const vscode = require('vscode');
const path = require('node:path');
const { friendlyError } = require('../../core/utils');
const { DocumentService } = require('../../infrastructure/document-service');
const { getShellHtml } = require('./webviews');
const { OFFICE_VIEW_TYPE, PDF_VIEW_TYPE } = require('../../core/constants');

function resolveLink(href, source) {
  const value = href.trim();
  if (!value || value.startsWith('#') || /[\u0000-\u001f]/.test(value)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    const target = vscode.Uri.parse(value);
    return ['http', 'https', 'mailto', 'tel', 'file'].includes(target.scheme.toLowerCase()) ? target : null;
  }
  if (value.startsWith('//') || !['file', 'vscode-remote'].includes(source.scheme)) return null;
  const parsed = new URL(value, 'https://office.invalid/');
  // Resolve the original relative path: URL's root would discard leading ../ segments.
  const originalPath = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  return source.with({
    path: originalPath ? path.posix.resolve(path.posix.dirname(source.path), originalPath) : source.path,
    query: parsed.search.slice(1), fragment: parsed.hash.slice(1)
  });
}

class ReadonlyOfficeDocument {
  constructor(uri) {
    this.uri = uri;
  }

  dispose() {}
}

class OfficeViewerProvider {
  constructor(context) {
    this.context = context;
    this.documents = new DocumentService(context);
  }

  openCustomDocument(uri) {
    return new ReadonlyOfficeDocument(uri);
  }

  async resolveCustomEditor(document, panel) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        this.context.globalStorageUri,
        vscode.Uri.joinPath(document.uri, '..')
      ]
    };
    panel.title = `${path.basename(document.uri.path)} · solo lectura`;

    let disposed = false;
    let rendering = false;
    let renderAgain = false;

    const render = async () => {
      if (disposed) return;
      if (rendering) {
        renderAgain = true;
        return;
      }
      rendering = true;
      panel.webview.postMessage({ type: 'loading' });
      try {
        const payload = await this.documents.createPayload(document.uri, panel.webview);
        if (!disposed) await panel.webview.postMessage({ type: 'document', payload });
      } catch (error) {
        if (!disposed) await panel.webview.postMessage({
          type: 'error',
          message: friendlyError(error),
          detail: error instanceof Error ? error.message : String(error)
        });
      } finally {
        rendering = false;
        if (renderAgain) {
          renderAgain = false;
          void render();
        }
      }
    };

    const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'ready' || message?.type === 'reload') {
        await render();
      } else {
        try {
          if (message?.type === 'openLink' && typeof message.href === 'string') {
            const target = resolveLink(message.href, document.uri);
            if (!target) throw new Error('Este tipo de enlace no es compatible.');
            if (['http', 'https', 'mailto', 'tel'].includes(target.scheme.toLowerCase())) {
              if (!await vscode.env.openExternal(target)) throw new Error('No se pudo abrir el enlace en la aplicación predeterminada.');
            } else {
              const extension = path.extname(target.path).toLowerCase();
              if (/^\.(docx?|xlsx?|pptx?|odt|ods|odp|pdf)$/.test(extension)) {
                await vscode.commands.executeCommand('vscode.openWith', target, extension === '.pdf' ? PDF_VIEW_TYPE : OFFICE_VIEW_TYPE);
              } else {
                await vscode.commands.executeCommand('vscode.open', target);
              }
            }
          } else if (message?.type === 'openExternal') {
            if (document.uri.scheme !== 'file') throw new Error('La apertura externa requiere un archivo local. Descarga el archivo remoto primero.');
            if (!await vscode.env.openExternal(document.uri)) throw new Error('No hay una aplicación predeterminada para este archivo.');
          } else if (message?.type === 'openSettings') {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'devOffice.libreOfficePath');
          }
        } catch (error) {
          if (!disposed) await panel.webview.postMessage({ type: 'actionError', message: error instanceof Error ? error.message : String(error) });
        }
      }
    });

    let debounce;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.joinPath(document.uri, '..'), path.basename(document.uri.path))
    );
    const scheduleRender = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void render(), 250);
    };
    watcher.onDidChange(scheduleRender);
    watcher.onDidCreate(scheduleRender);
    watcher.onDidDelete(() => {
      if (!disposed) void panel.webview.postMessage({ type: 'error', message: 'El archivo se eliminó o se movió.', detail: 'Vuelve a abrirlo desde su ubicación actual.' });
    });

    panel.onDidDispose(() => {
      disposed = true;
      clearTimeout(debounce);
      watcher.dispose();
      messageDisposable.dispose();
    });

    panel.webview.html = getShellHtml(this.context, panel.webview);
  }

}

module.exports = { OfficeViewerProvider, resolveLink };
