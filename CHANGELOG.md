# Changelog

## [0.1.2] - 2026-10-27

- Búsqueda con resaltado, contador, navegación y distinción de mayúsculas en Word, Excel, PDF y presentaciones de texto.
- PDF con texto seleccionable, enlaces, índice de marcadores, salto a página y carga independiente del resto de formatos.
- Enlaces y marcadores de Word corregidos, incluyendo archivos relativos al documento.
- Índice de títulos, ajuste al ancho, zoom ampliado, posición persistente y apertura externa.
- Lectura correcta de hojas de Excel con filas/columnas vacías y exclusión de hojas ocultas.
- Recursos y permisos del webview corregidos; conversiones de LibreOffice con perfil aislado y sin procesos duplicados para el mismo archivo.
- Apertura de extensiones en mayúsculas, errores con acciones de recuperación y pruebas de navegador.

## [0.1.1] - 2026-10-01

- Added a Settings tab with general preferences, portable local import/export, configurable backup folders, automatic scheduling, optional encryption, and Google Drive setup.
- Added reusable Desktop OAuth credentials, connection checks, an upload switch, and extension-specific pending upload retries.
- Added viewer-settings snapshots without copying external documents or preview caches.

## [0.1.0] - 2026-09-07

- Organización por core, infraestructura, integraciones y presentación siguiendo dev-tracker.
- Build y watch compartidos para host, webview y estilos.
- Pruebas de lectores, CI Linux/Windows, documentación y empaquetado en dist.
- El cierre del editor detiene las recargas pendientes.

- Visor de solo lectura para Word, Excel, PowerPoint, OpenDocument y PDF.
- Navegación por hojas, páginas, zoom y actualización automática.
- Conversión local con LibreOffice y respaldo textual para `.pptx`.
