/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export — aggregate sessions for admin CSV
 * Logic: Single source `GET /api/coach/sessions`; group by coach + course; blank HKD column.
 */

import { api } from "./api";
import { buildCsvContent, downloadUtf8CsvBom } from "./csv-rfc4180";
import type { CoachSessionRow } from "./coach-sessions";

export type StudentAttendanceSession = {
  sessionDate: string;
  startTime: string;
  endTime: string;
  lessonNo: number | null;
  totalLessons: number | null;
};

export type StudentAttendanceDetail = {
  studentName: string;
  studentId: number;
  sessions: StudentAttendanceSession[];
};

export type CoachAttendanceIncomeRow = {
  coachName: string;
  courseName: string;
  studentNames: string[];
  students: string;
  attendanceDates: string;
  studentDetails: StudentAttendanceDetail[];
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

export function coachIncomeExportFilename(
  fromDate: string,
  toDate: string,
  coachSlug?: string
): string {
  const prefix = coachSlug
    ? `coach-attendance-income-${coachSlug}-`
    : "coach-attendance-income-";
  return `${prefix}${fromDate}_to_${toDate}.csv`;
}

function slugifyCoachName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]+/g, "")
    .slice(0, 40);
}

export function formatStudentSessionDateTime(session: StudentAttendanceSession): string {
  const date = session.sessionDate.slice(0, 10);
  if (session.startTime && session.endTime) return `${date} ${session.startTime}-${session.endTime}`;
  if (session.startTime) return `${date} ${session.startTime}`;
  return date;
}

export function formatStudentLessonLabel(session: StudentAttendanceSession): string {
  if (session.lessonNo != null && session.totalLessons != null) {
    return `第 ${session.lessonNo}/${session.totalLessons} 堂`;
  }
  if (session.lessonNo != null) return `第 ${session.lessonNo} 堂`;
  return "—";
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

function toStudentSession(session: CoachSessionRow): StudentAttendanceSession {
  return {
    sessionDate: session.session_date.trim().slice(0, 10),
    startTime: String(session.start_time ?? "").slice(0, 5),
    endTime: String(session.end_time ?? "").slice(0, 5),
    lessonNo: session.lesson_no ?? null,
    totalLessons: session.total_lessons ?? null
  };
}

function enrichSessionLessonMeta<T extends CoachSessionRow>(sessions: T[]): T[] {
  const byEnrollment = new Map<number, CoachSessionRow[]>();
  for (const s of sessions) {
    const list = byEnrollment.get(s.enrollment_id) ?? [];
    list.push(s);
    byEnrollment.set(s.enrollment_id, list);
  }
  for (const [, list] of byEnrollment) {
    list.sort(
      (a, b) =>
        a.session_date.localeCompare(b.session_date) ||
        String(a.start_time).localeCompare(String(b.start_time))
    );
  }
  return sessions.map((s) => {
    if (s.lesson_no != null && s.total_lessons != null) return s;
    const siblings = byEnrollment.get(s.enrollment_id) ?? [s];
    const idx = siblings.findIndex(
      (x) => x.session_date === s.session_date && x.student_id === s.student_id
    );
    const lesson_no = s.lesson_no ?? (idx >= 0 ? idx + 1 : undefined);
    const total_lessons = s.total_lessons ?? siblings.length;
    return { ...s, lesson_no, total_lessons };
  });
}

function aggregateCoachCourseRows(
  sessions: (CoachSessionRow & { coachName: string })[],
  fromDate: string,
  toDate: string
): CoachAttendanceIncomeRow[] {
  const buckets = new Map<
    string,
    {
      coachName: string;
      courseName: string;
      dates: Set<string>;
      byStudent: Map<string, { studentId: number; sessions: StudentAttendanceSession[] }>;
    }
  >();

  for (const s of sessions) {
    if (!sessionInRange(s.session_date, fromDate, toDate)) continue;
    const courseName = courseLabel(s);
    const key = `${s.coachName}\0${courseName}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { coachName: s.coachName, courseName, dates: new Set(), byStudent: new Map() };
      buckets.set(key, bucket);
    }
    const studentName = String(s.student_name ?? "").trim();
    if (!studentName) continue;
    bucket.dates.add(s.session_date.trim().slice(0, 10));
    let studentBucket = bucket.byStudent.get(studentName);
    if (!studentBucket) {
      studentBucket = { studentId: s.student_id, sessions: [] };
      bucket.byStudent.set(studentName, studentBucket);
    }
    const detail = toStudentSession(s);
    const dedupeKey = `${detail.sessionDate}T${detail.startTime}`;
    if (!studentBucket.sessions.some((x) => `${x.sessionDate}T${x.startTime}` === dedupeKey)) {
      studentBucket.sessions.push(detail);
    }
  }

  return [...buckets.values()]
    .map((b) => {
      const studentDetails = [...b.byStudent.entries()]
        .sort(([a], [c]) => a.localeCompare(c, "zh-Hant"))
        .map(([studentName, info]) => ({
          studentName,
          studentId: info.studentId,
          sessions: [...info.sessions].sort(
            (a, c) =>
              a.sessionDate.localeCompare(c.sessionDate) ||
              a.startTime.localeCompare(c.startTime)
          )
        }));
      const studentNames = studentDetails.map((d) => d.studentName);
      return {
        coachName: b.coachName,
        courseName: b.courseName,
        studentNames,
        students: studentNames.join(","),
        attendanceDates: [...b.dates].sort().join(","),
        studentDetails
      };
    })
    .filter((r) => r.attendanceDates.length > 0)
    .sort(
      (a, b) =>
        a.coachName.localeCompare(b.coachName, "zh-Hant") ||
        a.courseName.localeCompare(b.courseName, "zh-Hant")
    );
}

/**
 * Load coaches' completed session rows for the date range.
 * Pass `coachId` to restrict to one coach; omit or use empty for all active coaches.
 */
export async function fetchCoachAttendanceIncomeRows(params: {
  fromDate: string;
  toDate: string;
  categoryIds?: number[];
  coachId?: number | "";
}): Promise<CoachAttendanceIncomeRow[]> {
  const coaches = (await api.coaches()) as { id: number; full_name: string; active?: boolean }[];
  const active = coaches.filter((c) => c.active !== false);
  let list = active.length ? active : coaches;

  if (params.coachId != null && params.coachId !== "") {
    const picked = coaches.find((c) => c.id === params.coachId);
    list = picked ? [picked] : [];
  }

  if (list.length === 0) return [];
  const batches = await Promise.all(
    list.map(async (coach) => {
      const rows = (await api.coachSessions(coach.id, {
        fromDate: params.fromDate,
        toDate: params.toDate,
        categoryIds: params.categoryIds?.length ? params.categoryIds : undefined
      })) as CoachSessionRow[];
      return enrichSessionLessonMeta(
        rows
          .filter(isValidCompletedAttendanceSession)
          .map((row) => ({ ...row, coachName: coach.full_name }))
      );
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
  toDate: string,
  coachName?: string
): void {
  const slug =
    coachName && rows.length > 0 && rows.every((r) => r.coachName === coachName)
      ? slugifyCoachName(coachName)
      : undefined;
  downloadUtf8CsvBom(
    coachIncomeExportFilename(fromDate, toDate, slug),
    coachAttendanceIncomeRowsToCsv(rows)
  );
}
