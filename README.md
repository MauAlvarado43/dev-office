# Dev Office Viewer

Extensión de VS Code para abrir documentos de oficina en modo de solo lectura y sin subirlos a servicios externos.

## Formatos

- `.docx`: conversión local a HTML, incluyendo tablas e imágenes.
- `.xlsx`: libro navegable por hojas, con encabezados de filas y columnas.
- `.pptx`: conversión local a PDF con LibreOffice; si falla, muestra el texto de cada diapositiva.
- `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`: conversión local mediante LibreOffice.
- `.pdf`: visor opcional integrado basado en PDF.js.

Los formatos de Office se abren con el visor de forma predeterminada. Para PDF usa **Reabrir editor con… → Office Viewer: PDF** o ejecuta **Office Viewer: Abrir vista previa**.

## Desarrollo

```bash
npm ci
npm run check
```

Pulsa `F5` en VS Code para abrir una ventana de desarrollo de extensiones. También puedes crear un paquete instalable:

```bash
npm run package
code --install-extension dist/dev-office-viewer-0.1.0.vsix
```

## Configuración

- `devOffice.libreOfficePath`: ruta a `libreoffice` o `soffice` cuando no está disponible en `PATH`.
- `devOffice.spreadsheet.maxRows`: filas máximas mostradas por hoja (1000 por defecto).
- `devOffice.spreadsheet.maxColumns`: columnas máximas mostradas por hoja (100 por defecto).

## Privacidad y límites

Todo el procesamiento se realiza localmente. La vista de Word busca legibilidad y no replica todos los detalles de maquetación. Excel muestra valores calculados guardados en el archivo, pero no ejecuta macros ni vuelve a calcular fórmulas. Los archivos protegidos con contraseña no son compatibles.

## Organización del repositorio

Consulta `docs/ARCHITECTURE.md`, `CONTRIBUTING.md` y `RELEASE.md`. Usa Node.js 22. `npm run watch` recompila durante el desarrollo; `npm run package` valida y genera el VSIX en `dist/`. En Windows también están disponibles los accesos de `bin/`.
