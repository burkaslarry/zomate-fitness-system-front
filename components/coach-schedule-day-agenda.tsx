"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Selected-day agenda — all sessions below calendar (Google Calendar day list)
 */

import { formatDateLabel } from "../lib/coach-schedule-dates";
import { calendarChipClass, formatSessionLine, type CoachSessionRow } from "../lib/coach-sessions";

type Props = {
  selectedDay: string;
  sessions: CoachSessionRow[];
  isPastDay: boolean;
  onReschedule?: (studentId: number, enrollmentId: number) => void;
};

export default function CoachScheduleDayAgenda({
  selectedDay,
  sessions,
  isPastDay,
  onReschedule
}: Props) {
  const sorted = [...sessions].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.student_name.localeCompare(b.student_name)
  );

  return (
    <section className="mt-4 border-t border-ink/10 pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{formatDateLabel(selectedDay)}</h3>
          <p className="mt-0.5 text-xs text-ink/55">
            {sorted.length > 0
              ? `${sorted.length} 位學員上堂`
              : isPastDay
                ? "此日沒有已排課程"
                : "此日暫無排程 — 按 + 新增上堂時間"}
          </p>
        </div>
        {sorted.length > 0 ? (
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-black">
            {sorted.length} 堂
          </span>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-canvas/50 px-4 py-6 text-center text-sm text-ink/45">
          {isPastDay ? "可於上方日曆查閱其他日期。" : "揀學員後按右下角 + 排程。"}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => (
            <li
              key={`${s.enrollment_id}-${s.session_date}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-semibold ${calendarChipClass(s.student_id)}`}
                  >
                    {s.student_name}
                  </span>
                  {s.attendance_status === "已簽到" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      已簽到
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-ink/70">{formatSessionLine(s)}</p>
                <p className="mt-0.5 text-[11px] text-ink/45">{s.course_title}</p>
              </div>
              {onReschedule && !isPastDay ? (
                <button
                  type="button"
                  onClick={() => onReschedule(s.student_id, s.enrollment_id)}
                  className="shrink-0 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-black"
                >
                  改期
                </button>
              ) : onReschedule && isPastDay ? (
                <button
                  type="button"
                  onClick={() => onReschedule(s.student_id, s.enrollment_id)}
                  className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-2.5 py-1.5 text-[11px] font-medium text-ink/70"
                >
                  改期
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
