const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
let bytes;
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === 'vscode') return { workspace: {
    fs: { readFile: async () => bytes },
    getConfiguration: () => ({ get: (key, fallback) => fallback })
  } };
  return originalLoad.call(this, id, ...args);
};
const { DocumentService } = require('../src/infrastructure/document-service');
Module._load = originalLoad;
const service = new DocumentService({});
test('Word convierte un documento OOXML a HTML', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Documento de prueba</w:t></w:r></w:p></w:body></w:document>');
  bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const payload = await service.createPayload({ path: '/test.docx' });
  assert.equal(payload.kind, 'word');
  assert.match(payload.html, /Documento de prueba/);
});
test('Excel mantiene hojas y valores calculados guardados', async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Datos').addRow(['Nombre', { formula: '1+2', result: 3 }]);
  bytes = await book.xlsx.writeBuffer();
  const payload = await service.createPayload({ path: '/test.xlsx' });
  assert.equal(payload.kind, 'excel');
  assert.deepEqual(payload.sheets[0].rows, [['Nombre', '3']]);
});
test('PowerPoint simplificado ordena las diapositivas y decodifica XML', async () => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide10.xml', '<a:t>Diez &amp; más</a:t>');
  zip.file('ppt/slides/slide2.xml', '<a:t>Dos</a:t>');
  bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const payload = await service.powerPointTextPayload({ path: '/test.pptx' }, 'test');
  assert.deepEqual(payload.slides, [{ number: 2, text: ['Dos'] }, { number: 10, text: ['Diez & más'] }]);
});
test('PDF usa la URI del webview y rechaza formatos no soportados', async () => {
  const payload = await service.createPayload({ path: '/test.PDF' }, { asWebviewUri: () => 'webview://test.pdf' });
  assert.equal(payload.source, 'webview://test.pdf');
  await assert.rejects(service.createPayload({ path: '/test.exe' }), /no es compatible/);
});
