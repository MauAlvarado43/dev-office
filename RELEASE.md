# Publicar una versión

1. Añade las notas a `CHANGELOG.md` bajo un encabezado `## [x.y.z]`.
2. Actualiza `version` en `package.json` con el mismo valor.
3. Ejecuta `pnpm install --frozen-lockfile` y `pnpm run package`.
4. Instala `dist/dev-office-viewer-<versión>.vsix` con `code --install-extension` y realiza las comprobaciones manuales de `CONTRIBUTING.md`.
5. Integra el cambio en `main`.

El workflow **Validate and release** valida y genera el paquete portable en Linux y Windows. En cada push a `main`, crea o actualiza el GitHub Release `v{version}` con el VSIX generado en Linux y las notas de la sección correspondiente del changelog.

El workflow falla antes de publicar si la versión de `package.json` no tiene una sección de notas. El paquete no incluye LibreOffice; usa la instalación del equipo donde se ejecuta el host de la extensión.
