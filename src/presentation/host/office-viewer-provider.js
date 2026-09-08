const vscode = require('vscode');
const path = require('node:path');
const { friendlyError } = require('../../core/utils');
const { DocumentService } = require('../../infrastructure/document-service');
const { getShellHtml } = require('./webviews');

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
        await panel.webview.postMessage({ type: 'document', payload });
      } catch (error) {
        await panel.webview.postMessage({
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
      } else if (message?.type === 'openLink' && typeof message.href === 'string') {
        const target = vscode.Uri.parse(message.href);
        if (['http', 'https', 'mailto'].includes(target.scheme)) {
          await vscode.env.openExternal(target);
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

    panel.onDidDispose(() => {
      disposed = true;
      clearTimeout(debounce);
      watcher.dispose();
      messageDisposable.dispose();
    });

    panel.webview.html = getShellHtml(this.context, panel.webview);
  }

}

module.exports = { OfficeViewerProvider };
