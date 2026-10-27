import { textIndex, rangeFor } from './text-index';
const { findMatches } = require('../../core/search');

const vscode = acquireVsCodeApi();
const byId = (id) => document.getElementById(id);
const elements = {
  name: byId('document-name'), loading: byId('loading'), content: byId('content'),
  notice: byId('notice'), viewport: byId('viewport'), pageControls: byId('page-controls'),
  previousPage: byId('previous-page'), nextPage: byId('next-page'), pageLabel: byId('page-label'),
  pageNumber: byId('page-number'), zoomLabel: byId('zoom-label'), searchBar: byId('search-bar'),
  searchInput: byId('search-input'), searchStatus: byId('search-status'), outline: byId('outline')
};
const saved = vscode.getState() || {};
const state = {
  payload: null, pdf: null, pdfLoading: null, pdfjs: null, page: 1, zoom: 1, sheet: 0,
  generation: 0, pageRender: 0, searchGeneration: 0, renderTask: null, textLayer: null, loading: true,
  textCache: new Map(), matches: [], match: -1, index: null, selectSheet: null
};

function persist() {
  if (!state.loading) vscode.setState(readingPosition());
}
function readingPosition() {
  return { page: state.page, zoom: state.zoom, sheet: state.sheet,
    scrollTop: elements.viewport.scrollTop, scrollLeft: elements.viewport.scrollLeft };
}
function action(callback) {
  return (...args) => Promise.resolve().then(() => callback(...args)).catch((error) => {
    if (error?.name !== 'RenderingCancelledException' && error?.name !== 'AbortException') {
      showError('No se pudo mostrar el documento.', error?.message || String(error));
    }
  });
}
byId('reload').addEventListener('click', () => vscode.postMessage({ type: 'reload' }));
byId('open-external').addEventListener('click', () => vscode.postMessage({ type: 'openExternal' }));
byId('zoom-in').addEventListener('click', action(() => changeZoom(state.zoom + 0.1)));
byId('zoom-out').addEventListener('click', action(() => changeZoom(state.zoom - 0.1)));
elements.zoomLabel.addEventListener('click', action(() => changeZoom(1)));
byId('fit-width').addEventListener('click', action(fitWidth));
elements.previousPage.addEventListener('click', action(() => goToPage(state.page - 1)));
elements.nextPage.addEventListener('click', action(() => goToPage(state.page + 1)));
elements.pageNumber.addEventListener('change', action(() => goToPage(Number(elements.pageNumber.value))));
elements.pageNumber.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    elements.pageNumber.blur();
  }
});
byId('toggle-search').addEventListener('click', () => toggleSearch());
byId('close-search').addEventListener('click', () => toggleSearch(false));
byId('next-match').addEventListener('click', action(() => selectMatch(1)));
byId('previous-match').addEventListener('click', action(() => selectMatch(-1)));
let searchTimer;
elements.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.searchGeneration += 1;
  searchTimer = setTimeout(action(runSearch), 180);
});
byId('match-case').addEventListener('change', action(runSearch));
byId('toggle-outline').addEventListener('click', () => {
  const open = elements.outline.classList.contains('hidden');
  elements.outline.classList.toggle('hidden', !open);
  byId('toggle-outline').setAttribute('aria-expanded', String(open));
});
let scrollTimer;
elements.viewport.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(persist, 150);
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleSearch(true);
  } else if (event.key === 'Escape' && !elements.searchBar.classList.contains('hidden')) {
    event.preventDefault();
    toggleSearch(false);
  } else if (event.target === elements.searchInput && event.key === 'Enter') {
    event.preventDefault();
    clearTimeout(searchTimer);
    void action(async () => {
      if (state.searchQuery !== searchKey()) await runSearch();
      else await selectMatch(event.shiftKey ? -1 : 1);
    })();
  } else if (state.pdf && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)) {
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      void action(() => goToPage(state.page + (event.key === 'PageDown' ? 1 : -1)))();
    }
  }
});

document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  if (href.startsWith('#')) {
    try {
      const id = decodeURIComponent(href.slice(1));
      const target = [...elements.content.querySelectorAll('[id], a[name]')]
        .find((node) => node.id === id || node.getAttribute('name') === id);
      if (target) target.scrollIntoView({ block: 'start' });
      else setNotice('No se encontró el destino de este enlace dentro del documento.');
    } catch { setNotice('El destino del enlace no es válido.'); }
  } else if (href) vscode.postMessage({ type: 'openLink', href });
});

window.addEventListener('message', ({ data }) => {
  if (data.type === 'loading') showLoading();
  else if (data.type === 'error') showError(data.message, data.detail);
  else if (data.type === 'actionError') setNotice(data.message);
  else if (data.type === 'document') void action(() => renderDocument(data.payload))();
});

function cancelDocument() {
  state.generation += 1;
  state.pageRender += 1;
  state.searchGeneration += 1;
  state.renderTask?.cancel();
  state.textLayer?.cancel();
  state.renderTask = null;
  state.textLayer = null;
  const loading = state.pdfLoading;
  state.pdf = null;
  state.pdfLoading = null;
  if (loading) void loading.destroy().catch(() => {});
  clearHighlights();
}

async function renderDocument(payload) {
  const position = state.pendingPosition || (state.payload ? readingPosition() : saved);
  state.pendingPosition = null;
  cancelDocument();
  const generation = state.generation;
  state.payload = payload;
  state.loading = false;
  state.page = Math.max(1, position.page || 1);
  state.zoom = Math.max(0.25, Math.min(3, position.zoom || 1));
  state.sheet = position.sheet || 0;
  state.index = null;
  state.selectSheet = null;
  state.textCache = new Map();
  state.matches = [];
  state.match = -1;
  state.searchQuery = null;
  elements.name.textContent = payload.name;
  elements.name.title = payload.name;
  const formats = { word: 'Word', excel: 'Excel', pdf: 'PDF', 'powerpoint-text': 'PowerPoint · Vista de texto' };
  byId('document-format').textContent = `${formats[payload.kind] || 'Documento'} · Solo lectura`;
  updateZoom();
  setNotice([payload.notice, ...(payload.warnings || [])].filter(Boolean).join('\n'));
  elements.content.replaceChildren();
  elements.content.style.zoom = '';
  elements.content.className = '';
  elements.loading.classList.add('hidden');
  elements.pageControls.classList.add('hidden');
  byId('outline-items').replaceChildren();
  byId('toggle-outline').classList.add('hidden');
  elements.outline.classList.add('hidden');
  byId('toggle-outline').setAttribute('aria-expanded', 'false');
  if (payload.kind === 'pdf') await renderPdf(payload.source, generation);
  else if (payload.kind === 'word') renderWord(payload.html);
  else if (payload.kind === 'excel') renderWorkbook(payload.sheets);
  else if (payload.kind === 'powerpoint-text') renderSlides(payload.slides);
  if (generation !== state.generation) return;
  if (elements.loading.classList.contains('hidden')) {
    elements.viewport.scrollTop = position.scrollTop || 0;
    elements.viewport.scrollLeft = position.scrollLeft || 0;
    await runSearch();
    persist();
  }
}

function addOutline(label, callback, depth = 0) {
  byId('toggle-outline').classList.remove('hidden');
  const button = document.createElement('button');
  button.textContent = label;
  button.title = label;
  button.style.paddingLeft = `${12 + Math.min(depth, 6) * 12}px`;
  button.addEventListener('click', action(callback));
  byId('outline-items').append(button);
}
function renderWord(html) {
  elements.content.className = 'word-view';
  const page = document.createElement('article');
  page.className = 'word-page scalable';
  page.innerHTML = html;
  elements.content.append(page);
  page.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    addOutline(heading.textContent, () => heading.scrollIntoView({ block: 'start' }), Number(heading.tagName[1]) - 1);
  });
  state.index = textIndex(page);
  applyCssZoom();
  setStatus('Word · Texto, tablas e imágenes · Busca con Ctrl/Cmd+F');
}

function renderWorkbook(sheets) {
  elements.content.className = 'excel-view';
  if (!sheets.length) {
    elements.content.append(emptyState('El libro no contiene hojas visibles.'));
    setStatus('Excel · Sin hojas visibles');
    return;
  }
  const tabs = document.createElement('nav');
  tabs.className = 'sheet-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Hojas del libro');
  const tableHost = document.createElement('div');
  tableHost.className = 'table-host scalable';
  tableHost.id = 'sheet-panel';
  tableHost.setAttribute('role', 'tabpanel');
  elements.content.append(tabs, tableHost);
  state.selectSheet = (index) => {
    state.sheet = index;
    [...tabs.children].forEach((button, buttonIndex) => {
      button.classList.toggle('active', buttonIndex === index);
      button.setAttribute('aria-selected', String(buttonIndex === index));
      button.tabIndex = buttonIndex === index ? 0 : -1;
    });
    tableHost.setAttribute('aria-labelledby', `sheet-${index}`);
    tableHost.replaceChildren(createSheetTable(sheets[index]));
    applyCssZoom();
    setStatus(`Excel · ${sheets[index].name} · ${sheets[index].totalRows.toLocaleString()} filas × ${sheets[index].totalColumns.toLocaleString()} columnas · Búsqueda en todas las hojas cargadas${sheets.some((sheet) => sheet.truncated) ? ' (datos limitados por Configuración)' : ''}`);
    applyHighlights();
    persist();
  };
  sheets.forEach((sheet, index) => {
    const button = document.createElement('button');
    button.id = `sheet-${index}`;
    button.className = 'sheet-tab';
    button.textContent = sheet.name;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'sheet-panel');
    button.addEventListener('click', () => state.selectSheet(index));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? sheets.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + sheets.length) % sheets.length;
      state.selectSheet(next);
      tabs.children[next].focus();
    });
    tabs.append(button);
  });
  state.selectSheet(Math.min(state.sheet, sheets.length - 1));
}
function createSheetTable(sheet) {
  const wrapper = document.createElement('div');
  if (sheet.truncated) {
    const warning = document.createElement('div');
    warning.className = 'sheet-warning';
    warning.textContent = `Vista parcial de ${sheet.totalRows.toLocaleString()} filas × ${sheet.totalColumns.toLocaleString()} columnas. La búsqueda cubre las celdas cargadas. Ajusta los límites en Configuración.`;
    wrapper.append(warning);
  }
  const table = document.createElement('table');
  table.className = 'sheet-table';
  table.setAttribute('aria-label', sheet.name);
  const columnCount = sheet.rows.reduce((count, row) => Math.max(count, row.length), 0);
  const header = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'row-number corner';
  header.append(corner);
  for (let column = 1; column <= columnCount; column += 1) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = columnLabel(column);
    header.append(th);
  }
  const head = document.createElement('thead');
  head.append(header);
  table.append(head);
  const body = document.createElement('tbody');
  sheet.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const number = document.createElement('th');
    number.className = 'row-number';
    number.scope = 'row';
    number.textContent = String(rowIndex + 1);
    tr.append(number);
    for (let column = 0; column < columnCount; column += 1) {
      const td = document.createElement('td');
      td.dataset.cell = `${rowIndex}:${column}`;
      td.textContent = row[column] || '';
      td.title = td.textContent;
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
  if (!slides.length) elements.content.append(emptyState('No se encontró texto legible en la presentación.'));
  slides.forEach((slide) => {
    const article = document.createElement('article');
    article.className = 'text-slide';
    const label = document.createElement('h2');
    label.className = 'slide-number';
    label.textContent = `Diapositiva ${slide.number}`;
    article.append(label);
    slide.text.forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      article.append(paragraph);
    });
    elements.content.append(article);
    addOutline(label.textContent, () => article.scrollIntoView({ block: 'start' }));
  });
  state.index = textIndex(elements.content);
  applyCssZoom();
  setStatus(`PowerPoint · ${slides.length} diapositivas · Vista de texto`);
}

async function renderPdf(source, generation) {
  elements.content.className = 'pdf-view';
  try {
    const assetBase = document.body.dataset.pdfBase;
    // PDF support must not prevent Word/Excel from starting if its module fails.
    state.pdfjs ||= await import(/* @vite-ignore */ `${assetBase}pdf.mjs`);
    if (generation !== state.generation) return;
    state.pdfjs.GlobalWorkerOptions.workerSrc = `${assetBase}pdf.worker.mjs`;
    const task = state.pdfjs.getDocument({
      url: source, cMapUrl: `${assetBase}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`, wasmUrl: `${assetBase}wasm/`, iccUrl: `${assetBase}iccs/`,
      isEvalSupported: false, enableXfa: false
    });
    state.pdfLoading = task;
    const pdf = await task.promise;
    if (generation !== state.generation) return;
    state.pdf = pdf;
    state.page = Math.min(state.page, pdf.numPages);
    elements.pageControls.classList.remove('hidden');
    elements.pageNumber.max = String(pdf.numPages);
    await renderPdfPage();
    const outline = await pdf.getOutline();
    if (generation !== state.generation) return;
    function append(items, depth = 0) {
      for (const item of items || []) {
        if (depth > 12) continue;
        if (item.dest) addOutline(item.title, () => goToDestination(item.dest), depth);
        else if (item.url) addOutline(item.title, () => vscode.postMessage({ type: 'openLink', href: item.url }), depth);
        append(item.items, depth + 1);
      }
    }
    append(outline);
  } catch (error) {
    if (generation !== state.generation) return;
    showError(error?.name === 'PasswordException' ? 'El PDF está protegido con contraseña.' : 'No se pudo representar el PDF.', error?.message || String(error));
  }
}
function pdfText(pageNumber) {
  if (!state.textCache.has(pageNumber)) {
    const pdf = state.pdf;
    state.textCache.set(pageNumber, pdf.getPage(pageNumber).then((page) => page.getTextContent()));
  }
  return state.textCache.get(pageNumber);
}
async function renderPdfPage() {
  const pdf = state.pdf;
  if (!pdf) return;
  const ticket = ++state.pageRender;
  const pageNumber = state.page;
  state.renderTask?.cancel();
  state.textLayer?.cancel();
  clearHighlights();
  const page = await pdf.getPage(pageNumber);
  if (ticket !== state.pageRender || pdf !== state.pdf) return;
  state.index = null;
  const viewport = page.getViewport({ scale: 1.45 * state.zoom });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-page';
  wrapper.style.width = `${viewport.width}px`;
  wrapper.style.height = `${viewport.height}px`;
  wrapper.style.setProperty('--total-scale-factor', viewport.scale * viewport.userUnit);
  wrapper.style.setProperty('--scale-round-x', '1px');
  wrapper.style.setProperty('--scale-round-y', '1px');
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  canvas.setAttribute('aria-label', `Página ${pageNumber}`);
  const textContainer = document.createElement('div');
  textContainer.className = 'textLayer';
  wrapper.append(canvas, textContainer);
  elements.content.replaceChildren(wrapper);
  elements.pageNumber.value = String(pageNumber);
  elements.pageLabel.textContent = `/ ${pdf.numPages}`;
  elements.previousPage.disabled = pageNumber <= 1;
  elements.nextPage.disabled = pageNumber >= pdf.numPages;
  setStatus(`PDF · Página ${pageNumber} de ${pdf.numPages} · Texto seleccionable · Busca en todo el documento`);
  const renderTask = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
  state.renderTask = renderTask;
  try {
    await renderTask.promise;
    if (ticket !== state.pageRender || pdf !== state.pdf) return;
    const text = await pdfText(pageNumber);
    if (ticket !== state.pageRender || pdf !== state.pdf) return;
    const layer = new state.pdfjs.TextLayer({ textContentSource: text, container: textContainer, viewport });
    state.textLayer = layer;
    await layer.render();
    if (ticket !== state.pageRender || pdf !== state.pdf) return;
    // Explicit dimensions also work in older webviews without CSS round().
    textContainer.style.width = `${viewport.rawDims.pageWidth * viewport.scale * viewport.userUnit}px`;
    textContainer.style.height = `${viewport.rawDims.pageHeight * viewport.scale * viewport.userUnit}px`;
    state.index = textIndex(textContainer);
    const annotations = await page.getAnnotations({ intent: 'display' });
    if (ticket !== state.pageRender || pdf !== state.pdf) return;
    for (const annotation of annotations) {
      if (annotation.subtype !== 'Link' || (!annotation.url && !annotation.dest)) continue;
      const [x1, y1] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]);
      const [x2, y2] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]);
      const link = document.createElement('a');
      link.className = 'pdf-link';
      link.style.cssText = `left:${Math.min(x1, x2)}px;top:${Math.min(y1, y2)}px;width:${Math.abs(x2 - x1)}px;height:${Math.abs(y2 - y1)}px`;
      link.href = annotation.url || '#';
      link.title = annotation.url || 'Ir al destino del documento';
      link.setAttribute('aria-label', link.title);
      if (annotation.dest) link.addEventListener('click', (event) => {
        event.preventDefault();
        void action(() => goToDestination(annotation.dest))();
      });
      wrapper.append(link);
    }
    applyHighlights();
  } catch (error) {
    if (ticket === state.pageRender && pdf === state.pdf && error?.name !== 'RenderingCancelledException' && error?.name !== 'AbortException') throw error;
  } finally {
    if (state.renderTask === renderTask) state.renderTask = null;
  }
}
async function goToDestination(destination) {
  const pdf = state.pdf;
  if (!pdf) return;
  const dest = typeof destination === 'string' ? await pdf.getDestination(destination) : destination;
  if (!dest || pdf !== state.pdf) return;
  const pageIndex = Number.isInteger(dest[0]) ? dest[0] : await pdf.getPageIndex(dest[0]);
  if (pdf === state.pdf) await goToPage(pageIndex + 1);
}
async function goToPage(number) {
  if (!state.pdf) return;
  state.page = Math.max(1, Math.min(state.pdf.numPages, Math.trunc(Number.isFinite(number) ? number : state.page)));
  await renderPdfPage();
  elements.viewport.scrollTop = 0;
  persist();
}
async function changeZoom(zoom) {
  state.zoom = Math.max(0.25, Math.min(3, Math.round(zoom * 100) / 100));
  updateZoom();
  if (state.pdf) await renderPdfPage();
  else applyCssZoom();
  persist();
}
function updateZoom() {
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  byId('zoom-out').disabled = state.zoom <= 0.25;
  byId('zoom-in').disabled = state.zoom >= 3;
}
async function fitWidth() {
  const available = Math.max(100, elements.viewport.clientWidth - 48);
  if (state.pdf) {
    const pdf = state.pdf;
    const page = await pdf.getPage(state.page);
    if (pdf === state.pdf) await changeZoom(available / page.getViewport({ scale: 1.45 }).width);
  } else {
    const target = elements.content.querySelector('.scalable') || elements.content;
    if (target.offsetWidth) await changeZoom(available / target.offsetWidth);
  }
}
function applyCssZoom() {
  elements.content.querySelectorAll('.scalable').forEach((node) => { node.style.zoom = state.zoom; });
  if (elements.content.classList.contains('scalable')) elements.content.style.zoom = state.zoom;
}

function toggleSearch(open = elements.searchBar.classList.contains('hidden')) {
  elements.searchBar.classList.toggle('hidden', !open);
  byId('toggle-search').setAttribute('aria-expanded', String(open));
  if (open) {
    elements.searchInput.focus();
    elements.searchInput.select();
    void action(runSearch)();
  } else {
    clearTimeout(searchTimer);
    state.searchGeneration += 1;
    state.matches = [];
    state.match = -1;
    state.searchQuery = null;
    clearHighlights();
    updateSearchStatus();
    byId('toggle-search').focus();
  }
}
function searchKey() { return JSON.stringify([elements.searchInput.value, byId('match-case').checked]); }
async function runSearch() {
  const ticket = ++state.searchGeneration;
  const generation = state.generation;
  const current = () => ticket === state.searchGeneration && generation === state.generation;
  state.matches = [];
  state.match = -1;
  clearHighlights();
  state.searchQuery = searchKey();
  const query = elements.searchInput.value;
  const matchCase = byId('match-case').checked;
  if (!query.trim() || elements.searchBar.classList.contains('hidden') || !state.payload || state.loading) {
    updateSearchStatus();
    return;
  }
  elements.searchStatus.textContent = 'Buscando…';
  byId('previous-match').disabled = true;
  byId('next-match').disabled = true;
  const matches = [];
  if (state.pdf) {
    const pdf = state.pdf;
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const content = await pdfText(page);
      if (!current()) return;
      const text = content.items.filter((item) => typeof item.str === 'string')
        .map((item) => item.str + (item.hasEOL ? '\n' : '')).join('');
      matches.push(...findMatches(text, query, matchCase).map((match) => ({ ...match, page })));
      elements.searchStatus.textContent = `Buscando… ${page}/${pdf.numPages}`;
      // Let input and cancellation run even for cached documents.
      if (page % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      if (!current()) return;
    }
  } else if (state.payload.kind === 'excel') {
    for (const [sheet, data] of state.payload.sheets.entries()) {
      for (const [row, values] of data.rows.entries()) {
        values.forEach((value, column) => {
          matches.push(...findMatches(value, query, matchCase).map((match) => ({ ...match, sheet, row, column })));
        });
        if (row % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        if (!current()) return;
      }
    }
  } else if (state.index) matches.push(...findMatches(state.index.text, query, matchCase));
  if (!current()) return;
  state.matches = matches;
  if (matches.length) await selectMatch(1);
  else {
    elements.searchStatus.textContent = state.pdf ? 'Sin coincidencias · Los PDF escaneados requieren OCR' : 'Sin coincidencias';
    byId('previous-match').disabled = true;
    byId('next-match').disabled = true;
  }
}
async function selectMatch(delta) {
  if (!state.matches.length) return;
  state.match = (state.match + delta + state.matches.length) % state.matches.length;
  const match = state.matches[state.match];
  if (match.page && match.page !== state.page) await goToPage(match.page);
  else if (match.sheet !== undefined && match.sheet !== state.sheet) state.selectSheet(match.sheet);
  if (state.matches[state.match] !== match) return;
  const range = applyHighlights();
  if (range) range.startContainer.parentElement.scrollIntoView({ block: 'center', inline: 'center' });
  updateSearchStatus();
}
function clearHighlights() {
  if (globalThis.CSS?.highlights) {
    CSS.highlights.delete('search-results');
    CSS.highlights.delete('search-current');
  }
}
function applyHighlights() {
  clearHighlights();
  const active = state.matches[state.match];
  let selected = null;
  const ranges = [];
  for (const match of state.matches) {
    if (match.page && match.page !== state.page) continue;
    if (match.sheet !== undefined && match.sheet !== state.sheet) continue;
    let range;
    if (match.sheet !== undefined) {
      const cell = elements.content.querySelector(`[data-cell="${match.row}:${match.column}"]`);
      range = cell && rangeFor(textIndex(cell), match);
    } else range = state.index && rangeFor(state.index, match);
    if (range && (ranges.length < 2000 || match === active)) ranges.push(range);
    if (match === active) selected = range;
  }
  if (globalThis.CSS?.highlights && globalThis.Highlight) {
    CSS.highlights.set('search-results', new Highlight(...ranges));
    if (selected) CSS.highlights.set('search-current', new Highlight(selected));
  }
  return selected;
}
function updateSearchStatus() {
  const count = state.matches.length;
  elements.searchStatus.textContent = count ? `${state.match + 1} de ${count}` : 'Escribe para buscar';
  byId('previous-match').disabled = !count;
  byId('next-match').disabled = !count;
}

function showLoading() {
  if (!state.loading) state.pendingPosition = readingPosition();
  cancelDocument();
  state.loading = true;
  state.matches = [];
  state.match = -1;
  updateSearchStatus();
  elements.loading.classList.remove('hidden');
  elements.loading.replaceChildren();
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  const text = document.createElement('span');
  text.textContent = 'Abriendo documento…';
  elements.loading.append(spinner, text);
  elements.content.classList.add('hidden');
  elements.notice.classList.add('hidden');
  elements.pageControls.classList.add('hidden');
  setStatus('Cargando documento…');
}
function showError(message, detail) {
  cancelDocument();
  state.loading = true;
  state.matches = [];
  state.match = -1;
  updateSearchStatus();
  elements.loading.classList.remove('hidden');
  elements.loading.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = message;
  const explanation = document.createElement('p');
  explanation.textContent = 'Puedes reintentar o abrir el archivo en otra aplicación. Los formatos antiguos y OpenDocument necesitan LibreOffice.';
  const actions = document.createElement('div');
  actions.className = 'error-actions';
  for (const [label, type] of [['Reintentar', 'reload'], ['Abrir externamente', 'openExternal'], ['Configurar LibreOffice', 'openSettings']]) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', () => vscode.postMessage({ type }));
    actions.append(button);
  }
  elements.loading.append(title, explanation, actions);
  if (detail) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Detalles del error';
    const pre = document.createElement('pre');
    pre.textContent = detail;
    details.append(summary, pre);
    elements.loading.append(details);
  }
  elements.content.classList.add('hidden');
  elements.pageControls.classList.add('hidden');
  setStatus('No se pudo abrir el documento · Revisa los detalles del error');
}
function setNotice(message) {
  elements.notice.textContent = message || '';
  elements.notice.classList.toggle('hidden', !message);
}
function setStatus(message) { byId('viewer-status').textContent = message; }
function emptyState(message) {
  const node = document.createElement('div');
  node.className = 'state-card';
  node.textContent = message;
  return node;
}
function columnLabel(column) {
  let label = '';
  while (column > 0) {
    column -= 1;
    label = String.fromCharCode(65 + (column % 26)) + label;
    column = Math.floor(column / 26);
  }
  return label;
}

window.addEventListener('pagehide', cancelDocument);
vscode.postMessage({ type: 'ready' });
