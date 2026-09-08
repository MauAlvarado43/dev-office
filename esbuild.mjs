import * as esbuild from 'esbuild';
import './scripts/copy-pdfjs.js';
const watch = process.argv.includes('--watch');
const builds = [
  { entryPoints: ['src/extension.js'], outfile: 'dist/extension.js', platform: 'node', format: 'cjs', target: 'node18', external: ['vscode'] },
  { entryPoints: ['src/presentation/webview/main.js'], outfile: 'dist/webview.js', platform: 'browser', format: 'esm', target: 'es2022' },
  { entryPoints: ['src/presentation/webview/styles/index.css'], outfile: 'dist/webview.css' }
];
for (const options of builds) {
  const config = { ...options, bundle: true, sourcemap: true, minify: !watch };
  if (watch) {
    const context = await esbuild.context(config);
    await context.watch();
  } else {
    await esbuild.build(config);
  }
}
