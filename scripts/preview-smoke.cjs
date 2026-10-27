const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const { chromium } = require('playwright');
const root = process.cwd();
let origin;
const original = Module._load;
Module._load = function (id, ...args) {
  if (id === 'vscode') return { Uri: { joinPath: (uri, ...parts) => ({ path: path.posix.join(uri.path, ...parts) }) } };
  return original.call(this, id, ...args);
};
const { getShellHtml } = require(path.join(root, 'src/presentation/host/webviews'));
Module._load = original;
function pdf(rotation = 0) {
  const stream = (text) => `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 9 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate ROTATION /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R /Annots [8 0 R 12 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate ROTATION /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream('BT /F1 20 Tf 72 700 Td (First page: Alpha) Tj 0 -40 Td (Go to second page) Tj 0 -40 Td (External website) Tj ET'),
    stream('BT /F1 20 Tf 72 700 Td (Second page: needle needle) Tj ET'),
    '<< /Type /Annot /Subtype /Link /Rect [72 650 250 680] /Border [0 0 0] /Dest [4 0 R /Fit] >>',
    '<< /Type /Outlines /First 10 0 R /Last 11 0 R /Count 2 >>',
    '<< /Title (First section) /Parent 9 0 R /Next 11 0 R /Dest [3 0 R /Fit] >>',
    '<< /Title (Second section) /Parent 9 0 R /Prev 10 0 R /Dest [4 0 R /Fit] >>',
    '<< /Type /Annot /Subtype /Link /Rect [72 610 250 640] /Border [0 0 0] /A << /S /URI /URI (https://example.com) >> >>'
  ];
  let output = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object.replace("ROTATION", String(rotation))}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    let html = getShellHtml({ extensionUri: { path: '/' } }, { cspSource: origin, asWebviewUri: (uri) => origin + uri.path });
    const nonce = html.match(/nonce-([^']+)/)[1];
    html = html.replace('<head>', `<head><script nonce="${nonce}">window.messages=[];window.saved={};window.acquireVsCodeApi=()=>({getState:()=>window.saved,setState:s=>window.saved=s,postMessage:m=>window.messages.push(m)});</script>`);
    res.setHeader('Content-Type', 'text/html');
    return res.end(html);
  }
  if (req.url.startsWith('/sample.pdf')) { res.setHeader('Content-Type', 'application/pdf'); return res.end(pdf(Number(new URL(req.url, origin).searchParams.get('rotation')))); }
  const file = path.join(root, new URL(req.url, origin).pathname);
  try {
    const ext = path.extname(file);
    res.setHeader('Content-Type', ext === '.css' ? 'text/css' : /\.m?js$/.test(ext) ? 'text/javascript' : 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  const send = (payload) => page.evaluate((payload) => window.postMessage({ type: 'document', payload }, '*'), payload);
  const status = (text) => page.waitForFunction((text) => document.getElementById('search-status').textContent === text, text);
  try {
    await page.goto(origin);
    page.setDefaultTimeout(10000);
    await page.waitForFunction(() => window.messages.some((m) => m.type === 'ready'));
    await send({ kind: 'word', name: 'Informe.docx', html: '<h1 id="intro">Informe</h1><p>Alpha <strong>beta</strong> ALPHA beta.</p><a href="https://example.com">Web</a><p><a href="../guia.pdf">Archivo</a></p><p style="height:1200px">Espacio</p><h2 id="fin">Fin</h2><a href="#intro">Volver al inicio</a>' });
    await page.locator('.word-page').waitFor();
    await page.keyboard.press('Control+f');
    await page.locator('#search-input').fill('alpha beta');
    await status('1 de 2');
    assert.equal(await page.evaluate(() => CSS.highlights.get('search-results').size), 2);
    await page.locator('#next-match').click(); await status('2 de 2');
    await page.locator('#match-case').check();
    await page.waitForFunction(() => document.getElementById('search-status').textContent === 'Sin coincidencias');
    await page.locator('#search-input').fill('Alpha beta'); await status('1 de 1');
    await page.keyboard.press('Escape');
    await page.locator('a[href="../guia.pdf"]').click();
    assert(await page.evaluate(() => window.messages.some((m) => m.href === '../guia.pdf')));
    await page.locator('a[href="#intro"]').click();
    assert(await page.locator('#viewport').evaluate((node) => node.scrollTop < 100));
    await page.locator('#toggle-outline').click();
    await page.locator('#outline-items button', { hasText: 'Fin' }).click();
    assert(await page.locator('#viewport').evaluate((node) => node.scrollTop > 500));
    await page.locator('#fit-width').click();
    await page.locator('#viewport').evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: 'dist/preview-word.png' });
    const oldScroll = await page.locator('#viewport').evaluate((node) => { node.scrollTop = 300; return node.scrollTop; });
    await page.evaluate(() => window.postMessage({type:'loading'}, '*'));
    await send({kind:'word',name:'Recarga.docx',html:'<h1>Recarga</h1>'+ '<p>Contenido del documento</p>'.repeat(100)});
    await page.locator('.word-page h1', {hasText:'Recarga'}).waitFor();
    assert.equal(await page.locator('#viewport').evaluate((node) => node.scrollTop), oldScroll);
    console.log('PASS Word: literal/cross-run search, highlights, case, relative/internal links, outline, fit');

    await send({ kind: 'excel', name: 'Libro.xlsx', sheets: [
      { name: 'Resumen', rows: [['needle', 'A']], totalRows: 1, totalColumns: 2 },
      { name: 'Datos', rows: [['other'], ['needle']], totalRows: 2, totalColumns: 1, truncated: true }
    ] });
    await page.locator('.sheet-table').waitFor();
    await page.keyboard.press('Control+f');
    await page.locator('#match-case').uncheck();
    await page.locator('#search-input').fill('needle'); await status('1 de 2');
    await page.locator('#next-match').click(); await status('2 de 2');
    assert.equal(await page.locator('.sheet-tab.active').innerText(), 'Datos');
    assert.equal(await page.evaluate(() => CSS.highlights.get('search-current').size), 1);
    await page.keyboard.press('Escape');
    console.log('PASS Excel: search across sheets, automatic sheet switch, truncation warning');

    await send({ kind: 'pdf', name: 'Documento.pdf', source: origin + '/sample.pdf' });
    await page.locator('.textLayer span').first().waitFor({ timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll('#outline-items button').length === 2);
    await page.keyboard.press('Control+f');
    await page.locator('#search-input').fill('needle'); await status('1 de 2');
    assert.equal(await page.locator('#page-number').inputValue(), '2');
    assert.equal(await page.evaluate(() => CSS.highlights.get('search-results').size), 2);
    assert(await page.locator('.textLayer').innerText().then((text) => text.includes('needle')));
    await page.screenshot({ path: 'dist/preview-pdf.png' });
    await page.keyboard.press('Escape');
    await page.locator('#page-number').fill('1');
    await page.locator('#page-number').press('Enter');
    await page.locator('#page-number').blur();
    await page.locator('a.pdf-link[href="#"]').waitFor();
    await page.locator('a.pdf-link[href="#"]').click();
    await page.waitForFunction(() => document.getElementById('page-number').value === '2');
    await page.locator('#previous-page').click();
    await page.locator('a.pdf-link[href="https://example.com/"]').click();
    assert(await page.evaluate(() => window.messages.some((m) => m.href === 'https://example.com/')));
    await page.locator('#zoom-in').click({ clickCount: 4, delay: 15 });
    await page.locator('#next-page').click();
    await page.locator('#zoom-out').click({ clickCount: 3, delay: 15 });
    await page.waitForTimeout(400);
    await page.locator('#zoom-label').click();
    await page.locator('#fit-width').click();
    console.log('PASS PDF: selectable text, all-page search, text highlights, links, outline, navigation/zoom races');

    await send({kind:'pdf',name:'Rotado.pdf',source:origin+'/sample.pdf?rotation=90'});
    await page.locator('.textLayer[data-main-rotation="90"] span').first().waitFor();
    await page.locator('#fit-width').click();
    await page.waitForTimeout(150);
    const rotated = await page.locator('.textLayer span').first().boundingBox();
    const canvas = await page.locator('.pdf-page canvas').boundingBox();
    assert(rotated.x >= canvas.x && rotated.y >= canvas.y && rotated.x + rotated.width <= canvas.x + canvas.width + 1);
    console.log('PASS rotated PDF text-layer alignment');

    await page.setViewportSize({ width: 430, height: 850 });
    await page.screenshot({ path: 'dist/preview-narrow.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 430);
    await page.evaluate(() => window.postMessage({ type: 'error', message: 'Archivo dañado', detail: 'ZIP inválido' }, '*'));
    await page.locator('#loading strong', { hasText: 'Archivo dañado' }).waitFor();
    assert.equal(await page.locator('.error-actions button').count(), 3);
    await page.evaluate(() => { document.body.dataset.pdfBase = '/missing-pdf/'; window.postMessage({ type: 'loading' }, '*'); });
    await send({ kind: 'word', name: 'Sin PDF.docx', html: '<p>Word funciona sin cargar PDF.js</p>' });
    await page.locator('.word-page', { hasText: 'Word funciona' }).waitFor();
    console.log('PASS responsive layout, actionable errors, Word independent of PDF module');
    assert.deepEqual(errors, []);
    console.log('ALL BROWSER CHECKS PASSED');
  } catch (error) {
    await page.screenshot({ path: 'dist/preview-failure.png' });
    console.error(await page.locator('#loading').textContent());
    console.error(errors);
    throw error;
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
