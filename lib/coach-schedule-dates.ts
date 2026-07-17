/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Week / month range helpers for schedule calendar nav
 */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday-based week containing dateKey. */
export function weekDaysContaining(dateKey: string): string[] {
  const d = parseDateKey(dateKey);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push(formatDateKey(cur));
  }
  return days;
}

export function weekRange(dateKey: string): { from: string; to: string } {
  const days = weekDaysContaining(dateKey);
  return { from: days[0]!, to: days[6]! };
}

export function monthRange(dateKey: string): { from: string; to: string } {
  const d = parseDateKey(dateKey);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: formatDateKey(from), to: formatDateKey(to) };
}

/** Grid rows (weeks) for month view; null = padding cell. */
export function monthGrid(dateKey: string): (string | null)[][] {
  const d = parseDateKey(dateKey);
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push(formatDateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function shiftWeek(dateKey: string, delta: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + delta * 7);
  return formatDateKey(d);
}

export function shiftMonth(dateKey: string, delta: number): string {
  const d = parseDateKey(dateKey);
  d.setMonth(d.getMonth() + delta);
  return formatDateKey(d);
}

export function shiftDay(dateKey: string, delta: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + delta);
  return formatDateKey(d);
}

export function formatDateLabel(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

export function shiftMonthValue(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}年${m}月`;
}

export function weekdayLabel(dateKey: string): string {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return labels[parseDateKey(dateKey).getDay()] ?? "";
}

export function monthTitle(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function weekTitle(dateKey: string): string {
  const { from, to } = weekRange(dateKey);
  const f = parseDateKey(from);
  const t = parseDateKey(to);
  if (f.getMonth() === t.getMonth()) {
    return `${f.getFullYear()}年${f.getMonth() + 1}月 ${f.getDate()}–${t.getDate()}日`;
  }
  return `${f.getMonth() + 1}/${f.getDate()} – ${t.getMonth() + 1}/${t.getDate()}`;
}
