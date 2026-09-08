# Empaquetado local

1. Actualiza la versión en `package.json` y el lockfile, y documenta el cambio en `CHANGELOG.md`.
2. Ejecuta `npm ci` y `npm run package`.
3. Instala `dist/dev-office-viewer-<versión>.vsix` con `code --install-extension` y realiza las comprobaciones manuales de `CONTRIBUTING.md`.

CI valida y genera artefactos en Linux y Windows. No publica releases ni en Marketplace. El paquete no incluye LibreOffice; usa la instalación del equipo donde se ejecuta el host de la extensión.
