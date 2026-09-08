const vscode = require('vscode');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { safeFileName } = require('../core/utils');
const execFileAsync = promisify(execFile);

async function convertToPdf(context, uri) {
    const stat = await vscode.workspace.fs.stat(uri);
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${uri.toString()}|${stat.mtime}|${stat.size}`)
      .digest('hex')
      .slice(0, 20);
    const outputDirectory = vscode.Uri.joinPath(context.globalStorageUri, 'conversions', fingerprint);
    await vscode.workspace.fs.createDirectory(outputDirectory);

    const sourceName = safeFileName(path.basename(uri.path));
    const sourceUri = vscode.Uri.joinPath(outputDirectory, sourceName);
    const outputUri = vscode.Uri.joinPath(outputDirectory, `${path.parse(sourceName).name}.pdf`);

    try {
      await vscode.workspace.fs.stat(outputUri);
      return outputUri;
    } catch {}

    const bytes = await vscode.workspace.fs.readFile(uri);
    await vscode.workspace.fs.writeFile(sourceUri, bytes);

    const configured = vscode.workspace.getConfiguration('devOffice').get('libreOfficePath', '').trim();
    const candidates = configured
      ? [configured]
      : process.platform === 'win32'
        ? ['soffice.exe', 'libreoffice.exe']
        : ['libreoffice', 'soffice'];

    let lastError;
    for (const executable of candidates) {
      try {
        await execFileAsync(executable, [
          '--headless', '--convert-to', 'pdf', '--outdir', outputDirectory.fsPath, sourceUri.fsPath
        ], { timeout: 90_000, windowsHide: true });
        await fs.access(outputUri.fsPath);
        return outputUri;
      } catch (error) {
        lastError = error;
      }
    }

    const suffix = configured
      ? 'Revisa devOffice.libreOfficePath en Configuración.'
      : 'Instala LibreOffice o configura devOffice.libreOfficePath.';
    throw new Error(`No fue posible convertir el documento a PDF. ${suffix} ${lastError?.message || ''}`.trim());
  }

module.exports = { convertToPdf };
