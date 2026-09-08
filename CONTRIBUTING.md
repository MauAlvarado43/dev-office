# Desarrollo

Usa Node.js 22 y npm. Instala dependencias con `npm ci`.

- `npm run watch`: recompila host, webview y estilos al editar.
- `npm run check`: valida sintaxis, ejecuta pruebas y compila.
- `npm run package`: ejecuta las verificaciones mediante `vscode:prepublish` y genera el VSIX en `dist/`.

Pulsa F5 para iniciar el Extension Development Host. Prueba DOCX con imágenes/tablas, XLSX con varias hojas, PDF con navegación/zoom y PPTX con y sin LibreOffice. Comprueba también recarga tras modificar el archivo y cierre del panel durante la carga.

Consulta [la arquitectura](docs/ARCHITECTURE.md) antes de añadir formatos. No edites `dist/` ni `media/vendor/`: se regeneran al compilar. Conserva el lockfile y añade pruebas para cambios en la lectura de documentos.
