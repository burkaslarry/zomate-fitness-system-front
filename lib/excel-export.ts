/** @feature [F04.5] */

export type ExcelColumn<T extends Record<string, unknown>> = {
  header: string;
  key: keyof T & string;
};

export async function exportRowsToExcelSheet<T extends Record<string, unknown>>(opts: {
  filename: string;
  sheetName: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName);
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.key, width: 18 }));
  opts.rows.forEach((row) => {
    const line: Record<string, unknown> = {};
    opts.columns.forEach((c) => {
      line[c.key] = row[c.key];
    });
    ws.addRow(line);
  });
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
