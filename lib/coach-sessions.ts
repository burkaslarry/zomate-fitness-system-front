/**
 * [F008][S002]
 * Feature: Coach Session Management
 * Step: Shared session row helpers — 教練上堂 / 學生上堂 / 教練出勤 single source
 * Logic: All coach views derive from GET /api/coach/sessions rows.
 */

export type CoachSessionRow = {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_phone: string;
  category_id: number | null;
  category_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  branch_name: string;
  checkin_pin: string;
  coach_time_confirmed: boolean;
  attendance_status: string;
  course_title: string;
};

export type CoachDayCourse = {
  id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  coach_time_confirmed?: boolean;
  enrollments: { student_id: number; student_name: string }[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build ISO local datetime for a session on its calendar date (HKT wall clock). */
export function sessionScheduledStartIso(session: CoachSessionRow): string {
  const [h, m] = session.start_time.split(":").map((x) => parseInt(x, 10) || 0);
  return `${session.session_date}T${pad2(h)}:${pad2(m)}:00`;
}

export function sessionScheduledEndIso(session: CoachSessionRow): string {
  const [h, m] = session.end_time.split(":").map((x) => parseInt(x, 10) || 0);
  return `${session.session_date}T${pad2(h)}:${pad2(m)}:00`;
}

export function groupSessionsByDate(sessions: CoachSessionRow[]): Map<string, CoachSessionRow[]> {
  const map = new Map<string, CoachSessionRow[]>();
  for (const s of sessions) {
    const list = map.get(s.session_date) ?? [];
    list.push(s);
    map.set(s.session_date, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.student_name.localeCompare(b.student_name));
  }
  return map;
}

export function sessionCountsByDate(
  sessions: CoachSessionRow[],
  options?: { confirmedOnly?: boolean }
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    if (options?.confirmedOnly && !s.coach_time_confirmed) continue;
    counts[s.session_date] = (counts[s.session_date] ?? 0) + 1;
  }
  return counts;
}

/** Map session rows on *day* into CourseOut-shaped cards for hourly calendar components. */
export function sessionsToDayCourses(sessions: CoachSessionRow[], day: string): CoachDayCourse[] {
  return sessions
    .filter((s) => s.session_date === day)
    .map((s) => ({
      id: s.enrollment_id,
      title: s.course_title,
      scheduled_start: sessionScheduledStartIso(s),
      scheduled_end: sessionScheduledEndIso(s),
      coach_time_confirmed: s.coach_time_confirmed,
      enrollments: [{ student_id: s.student_id, student_name: s.student_name }]
    }));
}

export function formatSessionLine(session: CoachSessionRow): string {
  return `${session.start_time} – ${session.end_time} · ${session.student_name} · ${session.category_name}`;
}

export function sessionRedeemedPairKey(enrollmentId: number, studentId: number): string {
  return `${enrollmentId}:${studentId}`;
}

/** WS may include session_calendar_date — match a specific lesson date on the calendar. */
export function sessionRedeemedDayKey(
  enrollmentId: number,
  studentId: number,
  sessionDate: string
): string {
  return `${enrollmentId}:${studentId}:${sessionDate}`;
}

export function sessionIsCheckedIn(
  session: CoachSessionRow,
  redeemedPairs: Set<string>
): boolean {
  if (session.attendance_status === "已簽到") return true;
  if (redeemedPairs.has(sessionRedeemedDayKey(session.enrollment_id, session.student_id, session.session_date))) {
    return true;
  }
  return redeemedPairs.has(sessionRedeemedPairKey(session.enrollment_id, session.student_id));
}
