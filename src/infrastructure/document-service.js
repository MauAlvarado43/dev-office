const vscode = require('vscode');
const path = require('node:path');
const mammoth = require('mammoth');
const sanitizeHtml = require('sanitize-html');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { slideNumber, decodeXml, friendlyError } = require('../core/utils');
const { convertToPdf } = require('../integrations/libreoffice');

class DocumentService {
  constructor(context) { this.context = context; }

  async createPayload(uri, webview) {
    const extension = path.extname(uri.path).toLowerCase();
    const name = path.basename(uri.path);

    if (extension === '.pdf') {
      return this.pdfPayload(uri, webview, name);
    }
    if (extension === '.docx') {
      return this.wordPayload(uri, name);
    }
    if (extension === '.xlsx') {
      return this.excelPayload(uri, name);
    }
    if (extension === '.pptx') {
      try {
        const pdfUri = await convertToPdf(this.context, uri);
        return this.pdfPayload(pdfUri, webview, name, 'Presentación convertida localmente con LibreOffice');
      } catch (conversionError) {
        const fallback = await this.powerPointTextPayload(uri, name);
        fallback.notice = `Vista simplificada: ${friendlyError(conversionError)}`;
        return fallback;
      }
    }

    if (['.doc', '.xls', '.ppt', '.odt', '.ods', '.odp'].includes(extension)) {
      const pdfUri = await convertToPdf(this.context, uri);
      return this.pdfPayload(pdfUri, webview, name, 'Documento convertido localmente con LibreOffice');
    }

    throw new Error(`El formato ${extension || '(sin extensión)'} no es compatible.`);
  }

  pdfPayload(uri, webview, name, notice = '') {
    return {
      kind: 'pdf',
      name,
      notice,
      source: webview.asWebviewUri(uri).toString()
    };
  }

  async wordPayload(uri, name) {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        convertImage: mammoth.images.imgElement(async (image) => ({
          src: `data:${image.contentType};base64,${await image.read('base64')}`
        }))
      }
    );

    const html = sanitizeHtml(result.value, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'figure', 'figcaption', 'sup', 'sub'
      ]),
      allowedAttributes: {
        a: ['href', 'name'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        table: ['summary'],
        th: ['colspan', 'rowspan', 'scope'],
        td: ['colspan', 'rowspan']
      },
      allowedSchemes: ['http', 'https', 'mailto', 'data'],
      allowedSchemesByTag: {
        a: ['http', 'https', 'mailto'],
        img: ['data']
      }
    });

    return {
      kind: 'word',
      name,
      html,
      warnings: result.messages.map((message) => message.message).slice(0, 8)
    };
  }

  async excelPayload(uri, name) {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes));

    const config = vscode.workspace.getConfiguration('devOffice.spreadsheet');
    const maxRows = config.get('maxRows', 1000);
    const maxColumns = config.get('maxColumns', 100);
    const sheets = [];

    workbook.eachSheet((worksheet) => {
      const rowLimit = Math.min(worksheet.actualRowCount || worksheet.rowCount, maxRows);
      const columnLimit = Math.min(worksheet.actualColumnCount || worksheet.columnCount, maxColumns);
      const rows = [];

      for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const values = [];
        for (let columnNumber = 1; columnNumber <= columnLimit; columnNumber += 1) {
          values.push(row.getCell(columnNumber).text || '');
        }
        rows.push(values);
      }

      sheets.push({
        name: worksheet.name,
        rows,
        totalRows: worksheet.actualRowCount || worksheet.rowCount,
        totalColumns: worksheet.actualColumnCount || worksheet.columnCount,
        truncated: (worksheet.actualRowCount || worksheet.rowCount) > rowLimit ||
          (worksheet.actualColumnCount || worksheet.columnCount) > columnLimit
      });
    });

    return { kind: 'excel', name, sheets };
  }

  async powerPointTextPayload(uri, name) {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const zip = await JSZip.loadAsync(Buffer.from(bytes));
    const slideFiles = Object.keys(zip.files)
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
    const slides = [];

    for (const fileName of slideFiles) {
      const xml = await zip.file(fileName).async('string');
      const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXml(match[1]).trim())
        .filter(Boolean);
      slides.push({ number: slideNumber(fileName), text });
    }

    return { kind: 'powerpoint-text', name, slides };
  }

}

module.exports = { DocumentService };
