/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Slot duration options (0.5 / 1 / 1.5 / 2 h) and overlap checks
 */

export const COACH_SLOT_DURATIONS = [0.5, 1, 1.5, 2] as const;
export type CoachSlotDuration = (typeof COACH_SLOT_DURATIONS)[number];
export const SCHEDULE_DAY_END_HOUR = 19;

export type HourRange = { start: number; end: number };

export function formatDurationLabel(hours: CoachSlotDuration): string {
  if (hours === 0.5) return "0.5 小時（30 分）";
  return `${hours} 小時`;
}

export function formatHourMinute(hourDecimal: number): string {
  const h = Math.floor(hourDecimal);
  const m = Math.round((hourDecimal - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeRange(startHour: number, durationHours: number): string {
  const end = startHour + durationHours;
  return `${formatHourMinute(startHour)} – ${formatHourMinute(end)}`;
}

export function slotWouldConflict(
  ranges: HourRange[],
  startHour: number,
  durationHours: number
): boolean {
  const start = startHour;
  const end = start + durationHours;
  if (end > SCHEDULE_DAY_END_HOUR + 1e-9) return true;
  for (const r of ranges) {
    if (start < r.end - 1e-9 && end > r.start + 1e-9) return true;
  }
  return false;
}

export function firstFittingDuration(
  ranges: HourRange[],
  startHour: number,
  prefer: CoachSlotDuration[] = [1, 0.5, 1.5, 2]
): CoachSlotDuration | null {
  for (const d of prefer) {
    if (!slotWouldConflict(ranges, startHour, d)) return d;
  }
  return null;
}

export function courseToRange(
  scheduledStart: string,
  scheduledEnd: string,
  day: string,
  localDateKey: (iso: string) => string
): HourRange | null {
  if (localDateKey(scheduledStart) !== day) return null;
  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);
  const startH = start.getHours() + start.getMinutes() / 60;
  let endH = end.getHours() + end.getMinutes() / 60;
  if (endH <= startH) endH = startH + 1;
  return { start: startH, end: endH };
}

export function rangesForDay<T extends { id: number; scheduled_start: string; scheduled_end: string; coach_time_confirmed?: boolean }>(
  courses: T[],
  day: string,
  excludeCourseIds: Set<number>,
  localDateKey: (iso: string) => string,
  options?: { confirmedOnly?: boolean }
): HourRange[] {
  const ranges: HourRange[] = [];
  for (const c of courses) {
    if (excludeCourseIds.has(c.id)) continue;
    if (options?.confirmedOnly && c.coach_time_confirmed === false) continue;
    const r = courseToRange(c.scheduled_start, c.scheduled_end, day, localDateKey);
    if (r) ranges.push(r);
  }
  return ranges;
}

/** [F008][S002] Occupied ranges from unified coach session rows (same source as 教練出勤). */
export function rangesForDayFromSessions(
  sessions: {
    enrollment_id: number;
    session_date: string;
    start_time: string;
    end_time: string;
    coach_time_confirmed?: boolean;
  }[],
  day: string,
  excludeEnrollmentIds: Set<number>,
  options?: { confirmedOnly?: boolean }
): HourRange[] {
  const ranges: HourRange[] = [];
  for (const s of sessions) {
    if (s.session_date !== day) continue;
    if (excludeEnrollmentIds.has(s.enrollment_id)) continue;
    if (options?.confirmedOnly && s.coach_time_confirmed === false) continue;
    const [sh, sm] = s.start_time.split(":").map((x) => parseInt(x, 10) || 0);
    const [eh, em] = s.end_time.split(":").map((x) => parseInt(x, 10) || 0);
    const start = sh + sm / 60;
    let end = eh + em / 60;
    if (end <= start) end = start + 1;
    ranges.push({ start, end });
  }
  return ranges;
}
