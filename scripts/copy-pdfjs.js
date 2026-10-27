const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const destination = path.join(__dirname, '..', 'media', 'vendor', 'pdfjs');

fs.mkdirSync(destination, { recursive: true });
// The legacy build supplies polyfills needed by older supported VS Code webviews.
fs.copyFileSync(path.join(packageRoot, 'legacy', 'build', 'pdf.mjs'), path.join(destination, 'pdf.mjs'));
fs.copyFileSync(path.join(packageRoot, 'legacy', 'build', 'pdf.worker.mjs'), path.join(destination, 'pdf.worker.mjs'));

for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  fs.cpSync(path.join(packageRoot, directory), path.join(destination, directory), {
    recursive: true,
    force: true
  });
}
