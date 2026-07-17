/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Hong Kong timezone display for payment / audit timestamps
 * Logic: Naive ISO from backend is UTC; always render in Asia/Hong_Kong.
 */

export function formatHktDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const trimmed = iso.trim();
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    dateStyle: "medium",
    timeStyle: "short"
  });
}
