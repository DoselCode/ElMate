import { deflateRawSync } from "node:zlib";

/**
 * Generador mínimo de planillas .xlsx (una hoja), sin dependencias: arma el XML de Office Open
 * y lo empaqueta en un zip. Alcanza para exportar tablas del panel: encabezado en negrita y
 * congelado, filtros, anchos de columna, fechas reales de Excel, montos y fila de totales.
 * Solo corre en el servidor (usa node:zlib); sin "server-only" para poder probarlo con vitest.
 */

export type XlsxFormat = "text" | "number" | "money" | "datetime";
export type XlsxValue = string | number | Date | null | undefined;
export type XlsxColumn = { header: string; width?: number; format?: XlsxFormat };
export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxValue[][];
  /** Fila final en negrita (por ejemplo, los totales). */
  footer?: XlsxValue[];
};

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Índices de cellXfs en styles.xml
const STYLE = { header: 1, datetime: 2, money: 3, bold: 4, boldMoney: 5 } as const;

/** Argentina no tiene horario de verano: UTC−3 fijo. Excel no guarda zona horaria, se escribe la hora local. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const EXCEL_EPOCH_DAYS = 25569; // 1970-01-01 en días de Excel

export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  return zip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["xl/workbook.xml", workbookXml(sheet.name)],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheetXml(sheet)],
  ]);
}

/** Respuesta de descarga (el nombre se limpia para Content-Disposition). */
export function xlsxResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ---- Hoja ----------------------------------------------------------------------------------

function sheetXml({ columns, rows, footer }: XlsxSheet): string {
  const lastCol = colName(columns.length - 1);
  const dataRows = rows.map((r, i) => rowXml(i + 2, r, columns, false));
  if (footer) dataRows.push(rowXml(rows.length + 2, footer, columns, true));
  const header = `<row r="1">${columns.map((c, i) => `<c r="${colName(i)}1" s="${STYLE.header}" t="inlineStr"><is><t xml:space="preserve">${esc(c.header)}</t></is></c>`).join("")}</row>`;
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${dataRows.join("")}</sheetData>` +
    (rows.length > 0 ? `<autoFilter ref="A1:${lastCol}${rows.length + 1}"/>` : "") +
    `</worksheet>`
  );
}

function rowXml(r: number, values: XlsxValue[], columns: XlsxColumn[], bold: boolean): string {
  const cells = columns.map((col, i) => cellXml(`${colName(i)}${r}`, values[i], col.format ?? "text", bold)).join("");
  return `<row r="${r}">${cells}</row>`;
}

function cellXml(ref: string, value: XlsxValue, format: XlsxFormat, bold: boolean): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    const serial = (value.getTime() - AR_OFFSET_MS) / 86_400_000 + EXCEL_EPOCH_DAYS;
    return `<c r="${ref}" s="${STYLE.datetime}"><v>${serial}</v></c>`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const s = format === "money" ? (bold ? STYLE.boldMoney : STYLE.money) : bold ? STYLE.bold : 0;
    return `<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${bold ? ` s="${STYLE.bold}"` : ""} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

/** 0 → A, 25 → Z, 26 → AA */
function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Escapa XML y quita los caracteres de control que Excel rechaza. */
function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel no admite : \ / ? * [ ] en el nombre de la hoja, y lo corta en 31 caracteres. */
function workbookXml(name: string): string {
  const safe = name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Hoja1";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${esc(safe)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

// cellXfs: 0 normal · 1 encabezado · 2 fecha y hora · 3 monto · 4 negrita · 5 monto en negrita
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEDEFE6"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="6">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

// ---- Zip (deflate, sin cifrado) ------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: [string, string][]): Uint8Array {
  const encoder = new TextEncoder();
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // Fecha fija 1/1/2026 en formato DOS: no importa para Excel y deja el archivo reproducible
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const [name, content] of files) {
    const nameBytes = Buffer.from(encoder.encode(name));
    const raw = encoder.encode(content);
    const data = deflateRawSync(raw);
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // versión necesaria
    header.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBytes, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // versión que lo creó
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += header.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...local, ...central, end]));
}
