/** @feature [F04.5] */

export type ExcelColumn<T extends Record<string, unknown>> = {
  header: string;
  key: keyof T & string;
};

const encoder = new TextEncoder();

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function dateTimeParts() {
  const d = new Date();
  return {
    modTime: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    modDate: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const { modTime, modDate } = dateTimeParts();

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const offset = local.length;

    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0x0800);
    writeU16(local, 0);
    writeU16(local, modTime);
    writeU16(local, modDate);
    writeU32(local, crc);
    writeU32(local, data.length);
    writeU32(local, data.length);
    writeU16(local, name.length);
    writeU16(local, 0);
    local.push(...name, ...data);

    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, modTime);
    writeU16(central, modDate);
    writeU32(central, crc);
    writeU32(central, data.length);
    writeU32(central, data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    central.push(...name);
  });

  const centralOffset = local.length;
  const centralSize = central.length;
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, centralSize);
  writeU32(end, centralOffset);
  writeU16(end, 0);

  return new Uint8Array([...local, ...central, ...end]);
}

function worksheetXml<T extends Record<string, unknown>>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[]
): string {
  const header = columns
    .map((c, idx) => `<c r="${columnName(idx)}1" t="inlineStr" s="1"><is><t>${escapeXml(c.header)}</t></is></c>`)
    .join("");
  const body = rows
    .map((row, ridx) => {
      const r = ridx + 2;
      const cells = columns
        .map((c, cidx) => {
          const value = row[c.key];
          const ref = `${columnName(cidx)}${r}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  const widths = columns
    .map((_c, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="18" customWidth="1"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="0"/></sheetPr>
  <dimension ref="A1:${columnName(Math.max(columns.length - 1, 0))}${Math.max(rows.length + 1, 1)}"/>
  <cols>${widths}</cols>
  <sheetData><row r="1">${header}</row>${body}</sheetData>
</worksheet>`;
}

export async function exportRowsToExcelSheet<T extends Record<string, unknown>>(opts: {
  filename: string;
  sheetName: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}) {
  const safeSheetName = opts.sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(safeSheetName, opts.columns, opts.rows)
    }
  ];

  const blob = new Blob([makeZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
