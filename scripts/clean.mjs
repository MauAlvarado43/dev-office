import { rm } from 'node:fs/promises';

await Promise.all([
  rm('dist', { recursive: true, force: true }),
  rm('media/vendor/pdfjs', { recursive: true, force: true })
]);
