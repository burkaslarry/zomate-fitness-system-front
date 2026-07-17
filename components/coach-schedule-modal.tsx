"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Schedule slot picker modal (9:00–19:00)
 * Logic: Opens after student/day click; duration 0.5 / 1 / 1.5 / 2 h in popup.
 */

import CoachHourlyDayView from "./coach-hourly-day-view";
import {
  COACH_SLOT_DURATIONS,
  type CoachSlotDuration,
  type HourRange,
  formatHourMinute,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

type Props = {
  open: boolean;
  studentName: string;
  courseTitle: string;
  selectedDay: string;
  dayCourses: {
    id: number;
    title: string;
    scheduled_start: string;
    scheduled_end: string;
    enrollments: { student_id: number; student_name: string }[];
  }[];
  occupiedRanges: HourRange[];
  startHour: number;
  durationHours: CoachSlotDuration;
  scheduling: boolean;
  onClose: () => void;
  onDayChange: (day: string) => void;
  onPickSlot: (hour: number, duration: CoachSlotDuration) => void;
  onDurationChange: (hours: CoachSlotDuration) => void;
  onConfirm: () => void;
};

function durationChipLabel(hours: CoachSlotDuration): string {
  if (hours === 0.5) return "0.5 hr";
  if (hours === 1.5) return "1.5 hr";
  return `${hours} hr`;
}

export default function CoachScheduleModal({
  open,
  studentName,
  courseTitle,
  selectedDay,
  dayCourses,
  occupiedRanges,
  startHour,
  durationHours,
  scheduling,
  onClose,
  onDayChange,
  onPickSlot,
  onDurationChange,
  onConfirm
}: Props) {
  if (!open) return null;

  const conflict = slotWouldConflict(occupiedRanges, startHour, durationHours);
  const endHour = startHour + durationHours;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-ink/10 bg-surface shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-schedule-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-surface px-4 py-3">
          <h2 id="coach-schedule-modal-title" className="text-sm font-semibold text-ink">
            排程時段
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink/60 hover:bg-canvas hover:text-ink"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs text-ink/70">
            正在為 <strong className="text-ink">{studentName}</strong> 排程 · {courseTitle} · 點選空白時段（0.5–2 小時）
          </p>

          <label className="block text-xs text-ink/70">
            日期
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => onDayChange(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink"
            />
          </label>

          <CoachHourlyDayView
            hours={HOURS}
            dayCourses={dayCourses}
            occupiedRanges={occupiedRanges}
            selectedStudentName={studentName}
            startHour={startHour}
            durationHours={durationHours}
            onPickSlot={onPickSlot}
          />

          <div className="space-y-3 border-t border-ink/10 pt-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 bg-canvas px-3 py-2.5">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">開始</p>
                <p className="text-base font-semibold tabular-nums text-black">{formatHourMinute(startHour)}</p>
              </div>
              <span className="text-lg text-ink/25" aria-hidden>
                →
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">結束</p>
                <p className="text-base font-semibold tabular-nums text-black">{formatHourMinute(endHour)}</p>
              </div>
            </div>

            <fieldset>
              <legend className="text-xs font-medium text-ink/70">時長（點選時段後揀）</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {COACH_SLOT_DURATIONS.map((d) => {
                  const disabled = slotWouldConflict(occupiedRanges, startHour, d);
                  const checked = durationHours === d;
                  return (
                    <label
                      key={d}
                      className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-center text-sm font-semibold transition ${
                        checked
                          ? "border-primary bg-primary text-black ring-1 ring-primary/35"
                          : disabled
                            ? "cursor-not-allowed border-ink/10 bg-ink/[0.04] text-ink/30"
                            : "border-ink/15 bg-surface text-black hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="coach-slot-duration"
                        value={d}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onDurationChange(d)}
                        className="sr-only"
                      />
                      {durationChipLabel(d)}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              disabled={scheduling || conflict}
              onClick={onConfirm}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50 sm:w-auto"
            >
              {scheduling ? "提交中…" : "確認排程"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
