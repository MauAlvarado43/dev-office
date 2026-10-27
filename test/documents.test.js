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
test('Word conserva marcadores, enlaces internos y relativos sin permitir scripts', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>
    <w:p><w:bookmarkStart w:id="1" w:name="destino"/><w:r><w:t>Destino</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p>
    <w:p><w:hyperlink w:anchor="destino"><w:r><w:t>Ir al destino</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:hyperlink r:id="rId1"><w:r><w:t>Documento local</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:hyperlink r:id="rId2"><w:r><w:t>Enlace inseguro</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:hyperlink r:id="rId3"><w:r><w:t>Archivo absoluto</w:t></w:r></w:hyperlink></w:p>
  </w:body></w:document>`);
  zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="../anexos/guia.pdf" TargetMode="External"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///tmp/guia.pdf" TargetMode="External"/>
  </Relationships>`);
  bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const payload = await service.createPayload({ path: '/enlaces.docx' });
  assert.match(payload.html, /id="destino"/);
  assert.match(payload.html, /href="#destino"/);
  assert.match(payload.html, /href="\.\.\/anexos\/guia.pdf"/);
  assert.match(payload.html, /href="file:\/\/\/tmp\/guia.pdf"/);
  assert.doesNotMatch(payload.html, /javascript:/);
});
test('Excel conserva celdas dispersas y excluye hojas ocultas', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Dispersa');
  sheet.getCell('A1').value = 'Inicio';
  sheet.getCell('J25').value = 'Último dato';
  book.addWorksheet('Privada', { state: 'hidden' }).getCell('A1').value = 'Oculto';
  bytes = await book.xlsx.writeBuffer();
  const payload = await service.createPayload({ path: '/sparse.xlsx' });
  assert.equal(payload.sheets.length, 1);
  assert.equal(payload.sheets[0].rows[24][9], 'Último dato');
  assert.equal(payload.sheets[0].totalRows, 25);
  assert.equal(payload.sheets[0].totalColumns, 10);
});
test('Documentos dañados devuelven un error de lectura', async () => {
  bytes = Buffer.from('Esto no es un archivo ZIP');
  await assert.rejects(service.createPayload({ path: '/corrupt.docx' }));
  await assert.rejects(service.createPayload({ path: '/corrupt.xlsx' }));
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
