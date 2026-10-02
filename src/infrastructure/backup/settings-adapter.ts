import type { BackupAdapter } from './host';

export function settingsAdapter(): BackupAdapter {
  const exclusions = ['Documentos Word, Excel, PowerPoint y PDF abiertos desde carpetas externas / External Word, Excel, PowerPoint, and PDF documents', 'Caché de vistas previas / Preview cache'];
  return {
    coverage: 'Ajustes de Dev Office: LibreOffice y límites de filas y columnas. / Dev Office settings: LibreOffice path and row/column limits.',
    exclusions,
    async capture() { return { files: [], exclusions }; },
    async restore(payload) {
      if (payload.files.length) throw new Error('Dev Office sólo importa ajustes, no archivos de documentos.');
    }
  };
}
