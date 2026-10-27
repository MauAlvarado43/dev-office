# Dev Office Viewer

Extensión de VS Code para abrir documentos de oficina en modo de solo lectura y sin subirlos a servicios externos.

## Formatos

- `.docx`: conversión local a HTML, incluyendo tablas e imágenes.
- `.xlsx`: libro navegable por hojas, con encabezados de filas y columnas.
- `.pptx`: conversión local a PDF con LibreOffice; si falla, muestra el texto de cada diapositiva.
- `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`: conversión local mediante LibreOffice.
- `.pdf`: visor opcional integrado basado en PDF.js.

Los formatos de Office se abren con el visor de forma predeterminada. Para PDF usa **Reabrir editor con… → Office Viewer: PDF** o ejecuta **Office Viewer: Abrir vista previa**.

## Controles de la vista previa

- **Buscar** o `Ctrl/Cmd+F`: búsqueda literal con resaltado, contador y opción de distinguir mayúsculas. `Enter` y `Mayús+Enter` recorren los resultados; `Esc` cierra la búsqueda.
- **Word**: enlaces web, correo, archivos relativos al documento y marcadores internos. El índice lateral permite navegar por títulos.
- **PDF**: texto seleccionable, búsqueda en todas las páginas, enlaces y marcadores, salto a página, botones anterior/siguiente y teclas `PageUp`/`PageDown`. Los PDF escaneados sin texto necesitan OCR externo para poder buscarlos.
- **Excel**: búsqueda en todas las hojas visibles cargadas, cambiando de hoja al avanzar entre coincidencias. Las hojas ocultas no se muestran. Si el libro supera los límites configurados, se indica que la vista y la búsqueda son parciales.
- **Zoom** entre 25% y 300%, restablecer al pulsar el porcentaje y **Ajustar ancho**. Se conserva la página, hoja, zoom y posición al recargar la vista.
- **Abrir externo**: abre el archivo local con la aplicación predeterminada. Los errores incluyen detalles, reintento y acceso a la configuración de LibreOffice.

El comando de vista previa usa el archivo compatible activo o permite elegir otro. También aparece en la barra del editor y admite extensiones en mayúsculas.

## Desarrollo

```bash
pnpm install --frozen-lockfile
pnpm run check
```

Pulsa `F5` en VS Code para abrir una ventana de desarrollo de extensiones. También puedes crear un paquete instalable:

```bash
pnpm run package
code --install-extension dist/dev-office-viewer-0.1.2.vsix
```

## Configuración

- `devOffice.libreOfficePath`: ruta a `libreoffice` o `soffice` cuando no está disponible en `PATH`.
- `devOffice.spreadsheet.maxRows`: filas máximas mostradas por hoja (1000 por defecto).
- `devOffice.spreadsheet.maxColumns`: columnas máximas mostradas por hoja (100 por defecto).

## Privacidad y límites

Todo el procesamiento se realiza localmente. La vista de Word busca legibilidad y no replica todos los detalles de maquetación. Excel muestra valores calculados guardados en el archivo, pero no ejecuta macros ni vuelve a calcular fórmulas. Los archivos protegidos con contraseña no son compatibles.

PDF.js se carga únicamente al abrir un PDF, de modo que sus fallos no bloquean Word o Excel. LibreOffice usa un perfil aislado para evitar conflictos con una instancia de escritorio abierta.

## Organización del repositorio

Consulta `docs/ARCHITECTURE.md`, `CONTRIBUTING.md` y `RELEASE.md`. Usa Node.js 22 y pnpm 11. `pnpm run watch` recompila durante el desarrollo; `pnpm run package` valida y genera el VSIX en `dist/`. En Windows también están disponibles los accesos de `bin/`.

## Configuration and portable import/export

Open the gear icon or **Dev Office Viewer: Settings** in the Command Palette. The Settings tab includes general preferences, local `.devbackup` export/import, automatic backups, a configurable backup folder, optional encryption, and Google Drive setup. Exported files stay local; manual and automatic backups use the separate Drive upload switch. [Setup and recovery](docs/BACKUPS.md).
