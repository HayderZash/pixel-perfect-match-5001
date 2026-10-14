// Browser-only exporters: printable PDF (via print dialog, proper Arabic shaping) and Excel.
import * as XLSX from "xlsx";
import { currentBranding } from "./branding";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export { esc };

export function printDocument(title: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("اسمح بالنوافذ المنبثقة لتصدير PDF");
    return;
  }
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box} body{font-family:Tajawal,system-ui,sans-serif;color:#111;margin:24px;font-size:13px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:0 0 12px;color:#444;font-weight:500}
.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1d4a55;padding-bottom:10px;margin-bottom:16px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #999;padding:6px 8px;text-align:right} th{background:#eef2f2}
.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.card{border:1px dashed #555;border-radius:8px;padding:12px;display:flex;gap:12px;align-items:center;break-inside:avoid}
.card img{width:110px;height:110px} .card b{font-size:15px} .mono{font-family:monospace;font-size:14px;direction:ltr;display:inline-block}
.letter{page-break-after:always;padding:24px 8px;line-height:2} .letter:last-child{page-break-after:auto}
.sign{margin-top:48px;display:flex;justify-content:space-between}
.foot{margin-top:24px;font-size:11px;color:#666}
@media print{body{margin:10mm}}
</style></head><body>${bodyHtml}
<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),300))</script></body></html>`);
  w.document.close();
}

export function docHeader(title: string, subtitle = "") {
  const d = new Date().toLocaleDateString("ar-IQ");
  const b = currentBranding();
  return `<div class="head"><div><small>${esc(b.university_name)}${b.academic_year ? ` — العام الدراسي ${esc(b.academic_year)}` : ""}</small><h1>${esc(title)}</h1><h2>${esc(subtitle)}</h2></div><div>التاريخ: ${esc(d)}</div></div>`;
}

export function htmlTable(headers: string[], rows: (string | number | null | undefined)[][]) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

export function exportExcel(filename: string, sheet: string, headers: string[], rows: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  (ws as Record<string, unknown>)["!views"] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 30));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
}

export type TemplateColumn = { header: string; options?: string[]; width?: number };

/**
 * Excel template whose list columns only accept values that exist in the system
 * (dropdown + rejecting validation, backed by a hidden, protected lists sheet).
 */
export async function exportLockedTemplate(filename: string, sheetName: string, columns: TemplateColumn[], rows: unknown[][] = [], maxRows = 500) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("القوائم", { state: "veryHidden" });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 22 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  columns.forEach((c, i) => {
    if (!c.options) return;
    const opts = c.options.length ? c.options : ["—"];
    opts.forEach((o, j) => (lists.getCell(j + 1, i + 1).value = o));
    const col = lists.getColumn(i + 1).letter;
    for (let r = 2; r <= maxRows + 1; r++) {
      ws.getCell(r, i + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'القوائم'!$${col}$1:$${col}$${opts.length}`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "قيمة غير مسموحة",
        error: "اختر قيمة من القائمة فقط — القيم مأخوذة من بيانات النظام",
      };
    }
  });
  await lists.protect(crypto.randomUUID(), {});
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
