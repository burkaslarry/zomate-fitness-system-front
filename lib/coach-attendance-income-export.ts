/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export — aggregate sessions for admin CSV
 * Logic: Single source `GET /api/coach/sessions`; group by coach + course; blank HKD column.
 */

import { api } from "./api";
import { buildCsvContent, downloadUtf8CsvBom } from "./csv-rfc4180";
import type { CoachSessionRow } from "./coach-sessions";

export type CoachAttendanceIncomeRow = {
  coachName: string;
  courseName: string;
  students: string;
  attendanceDates: string;
};

export const COACH_INCOME_CSV_HEADERS = ["教練", "課程", "學員", "出勤時間", "金額 (HKD)"] as const;

const INVALID_ATTENDANCE_MARKERS = [
  "已取消",
  "取消",
  "cancelled",
  "canceled",
  "void",
  "voided",
  "deleted",
  "invalid",
  "作廢"
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Default range: first and last day of the current calendar month (local). */
export function defaultCoachIncomeDateRange(): { fromDate: string; toDate: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const fromDate = `${y}-${pad2(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const toDate = `${y}-${pad2(m + 1)}-${pad2(lastDay)}`;
  return { fromDate, toDate };
}

export function coachIncomeExportFilename(fromDate: string, toDate: string): string {
  return `coach-attendance-income-${fromDate}_to_${toDate}.csv`;
}

/**
 * Completed attendance only — matches staff UI (`已簽到`) and excludes cancelled / void rows.
 */
export function isValidCompletedAttendanceSession(session: CoachSessionRow): boolean {
  const status = String(session.attendance_status ?? "").trim();
  if (!status) return false;
  const lower = status.toLowerCase();
  for (const marker of INVALID_ATTENDANCE_MARKERS) {
    if (status.includes(marker) || lower.includes(marker.toLowerCase())) return false;
  }
  if (lower.includes("cancel") || lower.includes("void") || lower.includes("deleted")) return false;
  if (status === "已簽到") return true;
  if (status === "已完成" || lower === "completed" || lower === "attended") return true;
  return false;
}

function sessionInRange(sessionDate: string, fromDate: string, toDate: string): boolean {
  const d = sessionDate.trim();
  return d.length >= 10 && d >= fromDate && d <= toDate;
}

function courseLabel(session: CoachSessionRow): string {
  const name = String(session.category_name ?? session.course_title ?? "").trim();
  return name || "—";
}

function aggregateCoachCourseRows(
  sessions: (CoachSessionRow & { coachName: string })[],
  fromDate: string,
  toDate: string
): CoachAttendanceIncomeRow[] {
  const buckets = new Map<
    string,
    { coachName: string; courseName: string; students: Set<string>; dates: Set<string> }
  >();

  for (const s of sessions) {
    if (!sessionInRange(s.session_date, fromDate, toDate)) continue;
    const courseName = courseLabel(s);
    const key = `${s.coachName}\0${courseName}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { coachName: s.coachName, courseName, students: new Set(), dates: new Set() };
      buckets.set(key, bucket);
    }
    const student = String(s.student_name ?? "").trim();
    if (student) bucket.students.add(student);
    bucket.dates.add(s.session_date.trim().slice(0, 10));
  }

  return [...buckets.values()]
    .map((b) => ({
      coachName: b.coachName,
      courseName: b.courseName,
      students: [...b.students].sort((a, c) => a.localeCompare(c, "zh-Hant")).join(","),
      attendanceDates: [...b.dates].sort().join(",")
    }))
    .filter((r) => r.attendanceDates.length > 0)
    .sort(
      (a, b) =>
        a.coachName.localeCompare(b.coachName, "zh-Hant") ||
        a.courseName.localeCompare(b.courseName, "zh-Hant")
    );
}

/**
 * Load all coaches and their completed session rows for the date range (deduped at source API).
 */
export async function fetchCoachAttendanceIncomeRows(params: {
  fromDate: string;
  toDate: string;
  categoryIds?: number[];
}): Promise<CoachAttendanceIncomeRow[]> {
  const coaches = (await api.coaches()) as { id: number; full_name: string; active?: boolean }[];
  const active = coaches.filter((c) => c.active !== false);
  const list = active.length ? active : coaches;

  const batches = await Promise.all(
    list.map(async (coach) => {
      const rows = (await api.coachSessions(coach.id, {
        fromDate: params.fromDate,
        toDate: params.toDate,
        categoryIds: params.categoryIds?.length ? params.categoryIds : undefined
      })) as CoachSessionRow[];
      return rows
        .filter(isValidCompletedAttendanceSession)
        .map((row) => ({ ...row, coachName: coach.full_name }));
    })
  );

  return aggregateCoachCourseRows(batches.flat(), params.fromDate, params.toDate);
}

export function coachAttendanceIncomeRowsToCsv(rows: CoachAttendanceIncomeRow[]): string {
  return buildCsvContent(
    [...COACH_INCOME_CSV_HEADERS],
    rows.map((r) => [r.coachName, r.courseName, r.students, r.attendanceDates, ""])
  );
}

export function downloadCoachAttendanceIncomeCsv(
  rows: CoachAttendanceIncomeRow[],
  fromDate: string,
  toDate: string
): void {
  downloadUtf8CsvBom(coachIncomeExportFilename(fromDate, toDate), coachAttendanceIncomeRowsToCsv(rows));
}
