const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL, fileURLToPath } = require('node:url');
function fileUri(filePath) {
  return { path: filePath, fsPath: filePath, toString: () => pathToFileURL(filePath).href };
}
const outputFiles = new Set();
const calls = [];
let writes = 0;
let fail = false;
const sourcePath = path.resolve('fixtures', 'deck.ppt');
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === 'vscode') return {
    Uri: { joinPath: (uri, ...parts) => fileUri(path.join(uri.fsPath, ...parts)) },
    workspace: {
      getConfiguration: () => ({ get: () => '/tools/Libre Office/soffice' }),
      fs: {
        stat: async (uri) => {
          if (uri.path === sourcePath) return { mtime: 123, size: 42 };
          if (outputFiles.has(uri.path)) return { size: 100 };
          throw new Error('ENOENT');
        },
        createDirectory: async () => {}, readFile: async () => Buffer.from('fixture'),
        writeFile: async () => { writes += 1; }
      }
    }
  };
  if (id === 'node:fs/promises') return { access: async (filePath) => {
    if (!outputFiles.has(filePath)) throw new Error('ENOENT');
  } };
  if (id === 'node:child_process') return { execFile: (executable, args, options, callback) => {
    calls.push({ executable, args, options });
    setTimeout(() => {
      if (fail) return callback(new Error('conversion failed'));
      const directory = args[args.indexOf('--outdir') + 1];
      outputFiles.add(path.join(directory, 'deck.pdf'));
      callback(null, '', '');
    }, 5);
  } };
  return originalLoad.call(this, id, ...args);
};
const { convertToPdf } = require('../src/integrations/libreoffice');
Module._load = originalLoad;

test('LibreOffice comparte conversiones simultáneas, aísla su perfil y reutiliza el PDF', async () => {
  const context = { globalStorageUri: fileUri(path.resolve('fixtures', 'cache with spaces')) };
  const source = fileUri(sourcePath);
  const [first, second] = await Promise.all([convertToPdf(context, source), convertToPdf(context, source)]);
  assert.equal(first.fsPath, second.fsPath);
  assert.equal(calls.length, 1);
  assert.equal(writes, 1);
  assert.equal(calls[0].executable, '/tools/Libre Office/soffice');
  const profile = calls[0].args.find((arg) => arg.startsWith('-env:UserInstallation='));
  assert.equal(fileURLToPath(profile.split('=')[1]), path.join(path.dirname(first.fsPath), 'profile'));
  assert.equal(calls[0].options.timeout, 90000);
  await convertToPdf(context, source);
  assert.equal(calls.length, 1);
  outputFiles.clear();
  fail = true;
  await assert.rejects(convertToPdf(context, source), /No fue posible convertir/);
  fail = false;
  await convertToPdf(context, source);
  assert.equal(calls.length, 3, 'Una conversión fallida se puede reintentar');
});
