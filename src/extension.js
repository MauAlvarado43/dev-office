const vscode = require('vscode');
const path = require('node:path');
const { OFFICE_VIEW_TYPE, PDF_VIEW_TYPE } = require('./core/constants');
const { OfficeViewerProvider } = require('./presentation/host/office-viewer-provider');

function activate(context) {
  const provider = new OfficeViewerProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(OFFICE_VIEW_TYPE, provider, {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.window.registerCustomEditorProvider(PDF_VIEW_TYPE, provider, {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.commands.registerCommand('devOffice.openPreview', async (uri) => {
      let target = uri;
      if (!target) {
        const selection = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: 'Abrir en Office Viewer',
          filters: {
            'Documentos compatibles': ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf']
          }
        });
        target = selection?.[0];
      }
      if (!target) return;

      const viewType = path.extname(target.path).toLowerCase() === '.pdf'
        ? PDF_VIEW_TYPE
        : OFFICE_VIEW_TYPE;
      await vscode.commands.executeCommand('vscode.openWith', target, viewType);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
