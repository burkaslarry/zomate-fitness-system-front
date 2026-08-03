/**
 * [F004][S005]
 * Feature: Admin Reports & Financials
 * Step: Coach Attendance Income Export — aggregate sessions for admin CSV
 * Logic: Single source `GET /api/coach/sessions`; group by coach + course; blank HKD column.
 */

import { api } from "./api";
import { buildCsvContent, downloadUtf8CsvBom } from "./csv-rfc4180";
import type { CoachSessionRow } from "./coach-sessions";
import { todayHktDate } from "./format-hkt";

export type StudentAttendanceSession = {
  sessionDate: string;
  startTime: string;
  endTime: string;
  lessonNo: number | null;
  totalLessons: number | null;
  isAttended: boolean;
  attendanceStatus: string;
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

export const COACH_INCOME_CSV_HEADERS = [
  "教練",
  "課程",
  "學員",
  "出勤時間",
  "總堂數",
  "金額 (HKD)"
] as const;

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

/** CSV 學員欄（單堂）：`Jessie Yeung (第2堂)` */
export function formatStudentLessonCsvLabel(
  studentName: string,
  session: StudentAttendanceSession
): string {
  if (session.lessonNo != null) return `${studentName} (第${session.lessonNo}堂)`;
  return studentName;
}

export type CoachAttendanceIncomeCsvLessonRow = {
  coachName: string;
  courseName: string;
  studentName: string;
  session: StudentAttendanceSession;
};

/** One CSV row per checked-in lesson within the selected date range. */
export function flattenCoachAttendanceIncomeCsvRows(
  rows: CoachAttendanceIncomeRow[],
  fromDate: string,
  toDate: string
): CoachAttendanceIncomeCsvLessonRow[] {
  const out: CoachAttendanceIncomeCsvLessonRow[] = [];
  for (const row of rows) {
    for (const detail of row.studentDetails) {
      for (const session of detail.sessions) {
        if (session.isAttended && sessionInRange(session.sessionDate, fromDate, toDate)) {
          out.push({
            coachName: row.coachName,
            courseName: row.courseName,
            studentName: detail.studentName,
            session
          });
        }
      }
    }
  }
  return out.sort(
    (a, b) =>
      a.coachName.localeCompare(b.coachName, "zh-Hant") ||
      a.courseName.localeCompare(b.courseName, "zh-Hant") ||
      a.studentName.localeCompare(b.studentName, "zh-Hant") ||
      a.session.sessionDate.localeCompare(b.session.sessionDate) ||
      a.session.startTime.localeCompare(b.session.startTime) ||
      (a.session.lessonNo ?? 999) - (b.session.lessonNo ?? 999)
  );
}

/** Checked-in dates within the selected export range. */
export function collectAttendedDatesInPeriod(
  details: StudentAttendanceDetail[],
  fromDate: string,
  toDate: string
): string {
  const dates = new Set<string>();
  for (const detail of details) {
    for (const session of detail.sessions) {
      if (session.isAttended && sessionInRange(session.sessionDate, fromDate, toDate)) {
        dates.add(session.sessionDate);
      }
    }
  }
  return [...dates].sort().join(",");
}

/** Total completed sessions for the row within the selected export range. */
export function countAttendedSessionsInPeriod(
  details: StudentAttendanceDetail[],
  fromDate: string,
  toDate: string
): number {
  let count = 0;
  for (const detail of details) {
    for (const session of detail.sessions) {
      if (session.isAttended && sessionInRange(session.sessionDate, fromDate, toDate)) {
        count += 1;
      }
    }
  }
  return count;
}

/** 已簽到 · 待上堂 (future) · 未簽到 (past, not checked in). */
export function studentSessionStatusLabel(session: StudentAttendanceSession): string {
  if (session.isAttended) return "已簽到";
  const today = todayHktDate();
  if (session.sessionDate > today) return "待上堂";
  return "未簽到";
}

export function isNextUpcomingLesson(
  session: StudentAttendanceSession,
  allSessions: StudentAttendanceSession[]
): boolean {
  if (session.isAttended) return false;
  const today = todayHktDate();
  const next = [...allSessions]
    .filter((s) => !s.isAttended && s.sessionDate >= today)
    .sort(
      (a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) || a.startTime.localeCompare(b.startTime)
    )[0];
  if (!next) return false;
  return next.sessionDate === session.sessionDate && next.startTime === session.startTime;
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
  const attended = isValidCompletedAttendanceSession(session);
  return {
    sessionDate: session.session_date.trim().slice(0, 10),
    startTime: String(session.start_time ?? "").slice(0, 5),
    endTime: String(session.end_time ?? "").slice(0, 5),
    lessonNo: session.lesson_no ?? null,
    totalLessons: session.total_lessons ?? null,
    isAttended: attended,
    attendanceStatus: String(session.attendance_status ?? "").trim() || (attended ? "已簽到" : "未簽到")
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

function buildStudentScheduleSessions(
  studentName: string,
  enrollmentIds: number[],
  allSchedule: (CoachSessionRow & { coachName: string })[]
): StudentAttendanceSession[] {
  const idSet = new Set(enrollmentIds);
  const seen = new Set<string>();
  const out: StudentAttendanceSession[] = [];
  for (const s of allSchedule) {
    if (s.student_name.trim() !== studentName) continue;
    if (!idSet.has(s.enrollment_id)) continue;
    const detail = toStudentSession(s);
    const key = `${detail.sessionDate}T${detail.startTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(detail);
  }
  return out.sort(
    (a, c) =>
      (a.lessonNo ?? 999) - (c.lessonNo ?? 999) ||
      a.sessionDate.localeCompare(c.sessionDate) ||
      a.startTime.localeCompare(c.startTime)
  );
}

/** All checked-in dates for students on a row (full package history, not limited to filter range). */
export function collectAttendedDates(details: StudentAttendanceDetail[]): string {
  const dates = new Set<string>();
  for (const detail of details) {
    for (const session of detail.sessions) {
      if (session.isAttended) dates.add(session.sessionDate);
    }
  }
  return [...dates].sort().join(",");
}

function aggregateCoachCourseRows(
  completedSessions: (CoachSessionRow & { coachName: string })[],
  allScheduleSessions: (CoachSessionRow & { coachName: string })[],
  fromDate: string,
  toDate: string
): CoachAttendanceIncomeRow[] {
  const buckets = new Map<
    string,
    {
      coachName: string;
      courseName: string;
      dates: Set<string>;
      attendedStudents: Set<string>;
      enrollmentIdsByStudent: Map<string, Set<number>>;
    }
  >();

  for (const s of completedSessions) {
    if (!sessionInRange(s.session_date, fromDate, toDate)) continue;
    const courseName = courseLabel(s);
    const key = `${s.coachName}\0${courseName}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        coachName: s.coachName,
        courseName,
        dates: new Set(),
        attendedStudents: new Set(),
        enrollmentIdsByStudent: new Map()
      };
      buckets.set(key, bucket);
    }
    const studentName = String(s.student_name ?? "").trim();
    if (!studentName) continue;
    bucket.dates.add(s.session_date.trim().slice(0, 10));
    bucket.attendedStudents.add(studentName);
    let ids = bucket.enrollmentIdsByStudent.get(studentName);
    if (!ids) {
      ids = new Set();
      bucket.enrollmentIdsByStudent.set(studentName, ids);
    }
    ids.add(s.enrollment_id);
  }

  return [...buckets.values()]
    .map((b) => {
      const studentDetails = [...b.attendedStudents]
        .sort((a, c) => a.localeCompare(c, "zh-Hant"))
        .map((studentName) => {
          const enrollmentIds = [...(b.enrollmentIdsByStudent.get(studentName) ?? [])];
          return {
            studentName,
            studentId:
              allScheduleSessions.find(
                (s) => s.student_name.trim() === studentName && enrollmentIds.includes(s.enrollment_id)
              )?.student_id ??
              completedSessions.find((s) => s.student_name.trim() === studentName)?.student_id ??
              0,
            sessions: buildStudentScheduleSessions(
              studentName,
              enrollmentIds,
              allScheduleSessions.filter(
                (s) => s.coachName === b.coachName && courseLabel(s) === b.courseName
              )
            )
          };
        });
      const studentNames = studentDetails.map((d) => d.studentName);
      const attendanceDates = collectAttendedDates(studentDetails);
      return {
        coachName: b.coachName,
        courseName: b.courseName,
        studentNames,
        students: studentNames.join(","),
        attendanceDates,
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

  const categoryIds = params.categoryIds?.length ? params.categoryIds : undefined;

  const batches = await Promise.all(
    list.map(async (coach) => {
      const [inRange, fullSchedule] = await Promise.all([
        api.coachSessions(coach.id, {
          fromDate: params.fromDate,
          toDate: params.toDate,
          categoryIds
        }) as Promise<CoachSessionRow[]>,
        api.coachSessions(coach.id, { categoryIds }) as Promise<CoachSessionRow[]>
      ]);

      const withCoach = (rows: CoachSessionRow[]) =>
        enrichSessionLessonMeta(rows.map((row) => ({ ...row, coachName: coach.full_name })));

      return {
        completed: withCoach(inRange).filter(isValidCompletedAttendanceSession),
        schedule: withCoach(fullSchedule)
      };
    })
  );

  return aggregateCoachCourseRows(
    batches.flatMap((b) => b.completed),
    batches.flatMap((b) => b.schedule),
    params.fromDate,
    params.toDate
  );
}

export function coachAttendanceIncomeRowsToCsv(
  rows: CoachAttendanceIncomeRow[],
  fromDate: string,
  toDate: string
): string {
  const lessonRows = flattenCoachAttendanceIncomeCsvRows(rows, fromDate, toDate);
  return buildCsvContent(
    [...COACH_INCOME_CSV_HEADERS],
    lessonRows.map(({ coachName, courseName, studentName, session }) => [
      coachName,
      courseName,
      formatStudentLessonCsvLabel(studentName, session),
      formatStudentSessionDateTime(session),
      "1",
      ""
    ])
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
    coachAttendanceIncomeRowsToCsv(rows, fromDate, toDate)
  );
}
