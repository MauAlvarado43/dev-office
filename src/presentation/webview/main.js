const vscode = acquireVsCodeApi();
const elements = {
  name: document.getElementById('document-name'),
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  notice: document.getElementById('notice'),
  pageControls: document.getElementById('page-controls'),
  previousPage: document.getElementById('previous-page'),
  nextPage: document.getElementById('next-page'),
  pageLabel: document.getElementById('page-label'),
  zoomLabel: document.getElementById('zoom-label')
};

const state = {
  payload: null,
  pdf: null,
  page: 1,
  zoom: 1,
  renderTask: null
};

document.getElementById('reload').addEventListener('click', () => {
  vscode.postMessage({ type: 'reload' });
});
document.getElementById('zoom-in').addEventListener('click', () => changeZoom(0.1));
document.getElementById('zoom-out').addEventListener('click', () => changeZoom(-0.1));
elements.previousPage.addEventListener('click', () => changePage(-1));
elements.nextPage.addEventListener('click', () => changePage(1));

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (/^(https?:|mailto:)/i.test(href)) {
    event.preventDefault();
    vscode.postMessage({ type: 'openLink', href });
  }
});

window.addEventListener('message', async ({ data }) => {
  if (data.type === 'loading') {
    showLoading();
  } else if (data.type === 'error') {
    showError(data.message, data.detail);
  } else if (data.type === 'document') {
    await renderDocument(data.payload);
  }
});

async function renderDocument(payload) {
  state.payload = payload;
  state.pdf = null;
  state.page = 1;
  state.zoom = 1;
  elements.name.textContent = payload.name;
  elements.zoomLabel.textContent = '100%';
  setNotice(payload.notice || warningsText(payload.warnings));
  elements.content.replaceChildren();
  elements.content.classList.remove('hidden');
  elements.loading.classList.add('hidden');
  elements.pageControls.classList.add('hidden');

  if (payload.kind === 'pdf') {
    await renderPdf(payload.source);
  } else if (payload.kind === 'word') {
    renderWord(payload.html);
  } else if (payload.kind === 'excel') {
    renderWorkbook(payload.sheets);
  } else if (payload.kind === 'powerpoint-text') {
    renderSlides(payload.slides);
  }
}

function renderWord(html) {
  elements.content.className = 'word-view';
  const page = document.createElement('article');
  page.className = 'word-page scalable';
  page.innerHTML = html;
  elements.content.append(page);
  applyCssZoom();
}

function renderWorkbook(sheets) {
  elements.content.className = 'excel-view';
  if (!sheets.length) {
    elements.content.append(emptyState('El libro no contiene hojas visibles.'));
    return;
  }

  const tabs = document.createElement('nav');
  tabs.className = 'sheet-tabs';
  tabs.setAttribute('aria-label', 'Hojas del libro');
  const tableHost = document.createElement('div');
  tableHost.className = 'table-host scalable';
  elements.content.append(tabs, tableHost);

  const selectSheet = (index) => {
    [...tabs.children].forEach((button, buttonIndex) => {
      button.classList.toggle('active', buttonIndex === index);
      button.setAttribute('aria-selected', String(buttonIndex === index));
    });
    tableHost.replaceChildren(createSheetTable(sheets[index]));
    applyCssZoom();
  };

  sheets.forEach((sheet, index) => {
    const button = document.createElement('button');
    button.className = 'sheet-tab';
    button.textContent = sheet.name;
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => selectSheet(index));
    tabs.append(button);
  });
  selectSheet(0);
}

function createSheetTable(sheet) {
  const wrapper = document.createElement('div');
  if (sheet.truncated) {
    const warning = document.createElement('div');
    warning.className = 'sheet-warning';
    warning.textContent = `Mostrando una parte de ${sheet.totalRows.toLocaleString()} filas × ${sheet.totalColumns.toLocaleString()} columnas. Ajusta los límites en Configuración.`;
    wrapper.append(warning);
  }

  const table = document.createElement('table');
  table.className = 'sheet-table';
  const body = document.createElement('tbody');
  const columnCount = Math.max(0, ...sheet.rows.map((row) => row.length));
  const header = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'row-number corner';
  header.append(corner);
  for (let column = 1; column <= columnCount; column += 1) {
    const th = document.createElement('th');
    th.textContent = columnLabel(column);
    header.append(th);
  }
  const head = document.createElement('thead');
  head.append(header);
  table.append(head);

  sheet.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const number = document.createElement('th');
    number.className = 'row-number';
    number.textContent = String(rowIndex + 1);
    tr.append(number);
    for (let column = 0; column < columnCount; column += 1) {
      const td = document.createElement('td');
      td.textContent = row[column] || '';
      tr.append(td);
    }
    body.append(tr);
  });
  table.append(body);
  wrapper.append(table);
  return wrapper;
}

function renderSlides(slides) {
  elements.content.className = 'slides-view scalable';
  if (!slides.length) {
    elements.content.append(emptyState('No se encontró texto legible en la presentación.'));
    return;
  }
  slides.forEach((slide) => {
    const article = document.createElement('article');
    article.className = 'text-slide';
    const label = document.createElement('span');
    label.className = 'slide-number';
    label.textContent = `Diapositiva ${slide.number}`;
    article.append(label);
    slide.text.forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      article.append(paragraph);
    });
    elements.content.append(article);
  });
  applyCssZoom();
}

async function renderPdf(source) {
  elements.content.className = 'pdf-view';
  elements.pageControls.classList.remove('hidden');
  try {
    const assetBase = globalThis.pdfAssetBase;
    const loadingTask = globalThis.pdfjsLib.getDocument({
      url: source,
      cMapUrl: `${assetBase}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
      wasmUrl: `${assetBase}wasm/`
    });
    state.pdf = await loadingTask.promise;
    await renderPdfPage();
  } catch (error) {
    showError('No se pudo representar el PDF.', error?.message || String(error));
  }
}

async function renderPdfPage() {
  if (!state.pdf) return;
  if (state.renderTask) {
    state.renderTask.cancel();
    state.renderTask = null;
  }
  const page = await state.pdf.getPage(state.page);
  const viewport = page.getViewport({ scale: 1.45 * state.zoom });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-page';
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  elements.content.replaceChildren(canvas);
  elements.pageLabel.textContent = `${state.page} / ${state.pdf.numPages}`;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= state.pdf.numPages;
  const context = canvas.getContext('2d', { alpha: false });
  state.renderTask = page.render({
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
  });
  try {
    await state.renderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
  } finally {
    state.renderTask = null;
  }
}

function changePage(delta) {
  if (!state.pdf) return;
  const next = Math.max(1, Math.min(state.pdf.numPages, state.page + delta));
  if (next === state.page) return;
  state.page = next;
  void renderPdfPage();
}

function changeZoom(delta) {
  state.zoom = Math.max(0.5, Math.min(2.5, Math.round((state.zoom + delta) * 10) / 10));
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  if (state.pdf) {
    void renderPdfPage();
  } else {
    applyCssZoom();
  }
}

function applyCssZoom() {
  document.querySelectorAll('.scalable').forEach((element) => {
    element.style.zoom = state.zoom;
  });
}

function showLoading() {
  elements.loading.classList.remove('hidden');
  elements.loading.replaceChildren();
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  const text = document.createElement('span');
  text.textContent = 'Actualizando documento…';
  elements.loading.append(spinner, text);
  elements.content.classList.add('hidden');
  elements.notice.classList.add('hidden');
}

function showError(message, detail) {
  elements.loading.classList.remove('hidden');
  elements.loading.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = message;
  const explanation = document.createElement('p');
  explanation.textContent = detail;
  const retry = document.createElement('button');
  retry.textContent = 'Reintentar';
  retry.addEventListener('click', () => vscode.postMessage({ type: 'reload' }));
  elements.loading.append(title, explanation, retry);
  elements.content.classList.add('hidden');
}

function setNotice(message) {
  elements.notice.textContent = message || '';
  elements.notice.classList.toggle('hidden', !message);
}

function warningsText(warnings) {
  if (!warnings?.length) return '';
  return `El documento se abrió con ${warnings.length} aviso${warnings.length === 1 ? '' : 's'} de compatibilidad.`;
}

function emptyState(message) {
  const node = document.createElement('div');
  node.className = 'state-card';
  node.textContent = message;
  return node;
}

function columnLabel(column) {
  let value = column;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

vscode.postMessage({ type: 'ready' });
