# Arquitectura

La organización sigue las fronteras de `dev-tracker`, conservando JavaScript y usando pnpm para la instalación y los scripts del proyecto. No se incorporan React, SQLite ni MCP porque el visor no los necesita.

| Ruta | Responsabilidad |
| --- | --- |
| `src/extension.js` | Activación, registro de editores y comando de apertura. |
| `src/core/` | Identificadores compartidos y utilidades deterministas. |
| `src/infrastructure/document-service.js` | Lectura de archivos, selección de formato y generación de payloads. |
| `src/integrations/libreoffice.js` | Conversión local y caché de PDF en el almacenamiento de VS Code. |
| `src/presentation/host/` | Ciclo de vida del editor, mensajes, watcher y HTML con CSP. |
| `src/presentation/webview/` | Interfaz del visor y estilos fuente. |
| `test/` | Pruebas con documentos generados en memoria. |
| `scripts/` | Validación, copia de PDF.js y empaquetado. |

Flujo: VS Code → proveedor → servicio de documentos → lector o LibreOffice → payload → webview.

El host interpreta `ready`, `reload`, `openLink`, `openExternal` y `openSettings`. Publica `loading`, `document`, `error` o `actionError`. Valida los esquemas de los enlaces antes de abrirlos; los archivos relativos se resuelven desde el documento original. Los payloads discriminan `word`, `excel`, `pdf` y `powerpoint-text` mediante `kind`.

El webview carga PDF.js bajo demanda y cancela las tareas anteriores al recargar o cambiar de página. PDF combina canvas, capa de texto y enlaces. `core/search.js` calcula offsets de búsquedas literales; `webview/text-index.js` los conecta con rangos DOM y CSS Highlights. La búsqueda recorre todas las páginas del PDF y todas las hojas cargadas de Excel. El estado de lectura se guarda con `webview.setState`.

Para añadir un formato, actualiza el manifiesto, el servicio y las pruebas; añade un renderizador al webview solamente si requiere un payload nuevo. Las utilidades compartidas no deben depender de VS Code. Los lectores no generan el HTML de la aplicación.

`esbuild.mjs` produce `dist/extension.js`, `dist/webview.js` y `dist/webview.css`. PDF.js se copia a `media/vendor/pdfjs`; ambas rutas son generadas y se excluyen de Git. El VSIX incluye solamente los bundles, PDF.js y los metadatos/documentación necesarios.
