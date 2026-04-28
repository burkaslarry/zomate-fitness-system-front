/*
 * RFC4180-style CSV helpers for Next.js mock admin routes only (same columns as FastAPI).
 * Production CSV authority: ``zomate-fitness-system-back`` — never duplicate schema drift here.
 */

export function csvEscapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscapeCell).join(",");
}

export function parseCsvRows(text: string): { headers: string[]; rows: string[][] } {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let q = false;
  const flushRow = () => {
    row.push(field);
    field = "";
    lines.push(row);
    row = [];
  };
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (q) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          q = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      flushRow();
      continue;
    }
    field += c;
  }
  row.push(field);
  lines.push(row);

  const nonempty = lines.filter((r) => r.some((cell) => cell.trim().length > 0));
  const headers = (nonempty[0] ?? []).map((h) => h.trim());
  const rowsData = nonempty.slice(1);
  return { headers, rows: rowsData };
}

export function dictRowsFromCsv(text: string): Record<string, string>[] {
  const { headers, rows } = parseCsvRows(text);
  if (headers.length === 0) return [];
  const out: Record<string, string>[] = [];
  for (const line of rows) {
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = (line[j] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}
