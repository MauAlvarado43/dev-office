function slideNumber(fileName) {
  return Number(fileName.match(/slide(\d+)\.xml$/)?.[1] || 0);
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeFileName(value) {
  return value.replace(/[^\p{L}\p{N}._ -]/gu, '_');
}

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/password|encrypted/i.test(message)) {
    return 'El documento parece estar protegido con contraseña y no puede abrirse en modo lectura.';
  }
  if (/ENOENT|FileNotFound|EntryNotFound/i.test(message)) return 'El archivo ya no está disponible en esta ubicación.';
  if (/EACCES|EPERM|NoPermissions/i.test(message)) return 'No tienes permiso para leer este archivo.';
  if (/zip|central directory|invalid signature|corrupt/i.test(message)) return 'El archivo está dañado o su contenido no corresponde a su extensión.';
  if (/libreoffice|soffice|convert/i.test(message)) {
    return 'Este formato necesita LibreOffice para conservar su diseño.';
  }
  return 'No se pudo abrir el documento.';
}

module.exports = { slideNumber, decodeXml, safeFileName, friendlyError };
