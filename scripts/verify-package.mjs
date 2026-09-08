import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
const { name, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const zip = await JSZip.loadAsync(readFileSync(new URL(`../dist/${name}-${version}.vsix`, import.meta.url)));
for (const path of ['package.json', 'dist/extension.js', 'dist/webview.js', 'dist/webview.css', 'media/vendor/pdfjs/pdf.mjs', 'media/vendor/pdfjs/pdf.worker.mjs', 'media/vendor/pdfjs/wasm/openjpeg.wasm', 'media/vendor/pdfjs/cmaps/UniJIS-UTF16-H.bcmap', 'media/vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf']) {
  if (!zip.file(`extension/${path}`)) throw new Error(`Falta en el VSIX: ${path}`);
}
for (const path of Object.keys(zip.files)) {
  if (/^extension\/(src|test|node_modules|scripts)\//.test(path) || /\.(map|vsix)$/.test(path)) {
    throw new Error(`Archivo de desarrollo en el VSIX: ${path}`);
  }
}
console.log('VSIX verificado: bundles y recursos PDF.js presentes, sin fuentes ni dependencias de desarrollo.');
