import { crc32, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "@/back/shared/xlsx";
import type { IncomeMonth, MovementRow } from "@/shared/types";
import { incomeSheet, movementsSheet } from "./excel";

/** Lee el zip generado (directorio central) y devuelve cada archivo descomprimido, verificando el CRC. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const buf = Buffer.from(bytes);
  const end = buf.length - 22;
  expect(buf.readUInt32LE(end)).toBe(0x06054b50);
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    const raw = inflateRawSync(buf.subarray(dataStart, dataStart + size));
    expect(crc32(raw)).toBe(crc);
    files[name] = raw.toString("utf8");
    p += 46 + nameLen;
  }
  return files;
}

const movement: MovementRow = {
  id: 1,
  created_at: "2026-11-28T15:30:00.000Z", // 12:30 en Buenos Aires
  type: "venta",
  quantity: -0.25,
  stock_after: 3.75,
  reason: 'Mate "imperial" <cuero> & más',
  sale_id: null,
  ticket_number: 42,
  variant_id: "v1",
  sku: "YER-1",
  product_name: "Yerba Ñandú",
  unit: "kg",
  variant_label: "1 kg",
  created_by: null,
  created_by_name: "Ana",
};

const month = (m: number, patch: Partial<IncomeMonth> = {}): IncomeMonth => ({
  month: `2026-${String(m).padStart(2, "0")}-01`,
  cash: 0, other: 0, total: 0, salesCount: 0, systemTotal: 0, cost: null, source: "sin datos", byMethod: [],
  ...patch,
});

describe("buildXlsx", () => {
  it("arma un .xlsx válido con las partes mínimas y escapa el texto", () => {
    const files = unzip(buildXlsx(movementsSheet([movement])));
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("Yerba Ñandú");
    expect(sheet).toContain("Mate &quot;imperial&quot; &lt;cuero&gt; &amp; más");
    expect(sheet).toContain('<autoFilter ref="A1:K2"/>');
    // 28/11/2026 12:30 hora argentina como número de serie de Excel
    const serial = Number(sheet.match(/<c r="A2" s="2"><v>([\d.]+)<\/v>/)?.[1]);
    expect(serial).toBeCloseTo(46354 + 12.5 / 24, 6);
    expect(sheet).toContain('<c r="F2"><v>-0.25</v></c>');
  });
});

describe("incomeSheet", () => {
  it("suma los totales y abre una columna por forma de pago", () => {
    const months = Array.from({ length: 12 }, (_, i) => month(i + 1));
    months[0] = month(1, { cash: 1000, other: 500, total: 1500, source: "historial" });
    months[1] = month(2, {
      cash: 200, other: 300, total: 500, salesCount: 3, systemTotal: 500, cost: 320, source: "sistema",
      byMethod: [{ name: "Débito", total: 300 }, { name: "Efectivo", total: 200 }],
    });
    const sheet = incomeSheet(2026, months);
    expect(sheet.columns.map((c) => c.header).slice(7)).toEqual(["Débito", "Efectivo"]);
    expect(sheet.rows[0].slice(0, 7)).toEqual(["Enero", 1000, 500, 1500, null, null, "Excel"]);
    expect(sheet.rows[1]).toEqual(["Febrero", 200, 300, 500, 180, 3, "Sistema", 300, 200]);
    expect(sheet.rows[2].slice(0, 4)).toEqual(["Marzo", null, null, null]);
    expect(sheet.footer).toEqual(["Total", 1200, 800, 2000, 180, 3, null, 300, 200]);
  });
});
