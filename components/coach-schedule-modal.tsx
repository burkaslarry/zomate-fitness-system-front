"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Schedule slot picker modal (9:00–19:00)
 * Logic: Opens after student/day click; duration 0.5 / 1 / 1.5 / 2 h in popup.
 */

import CoachDateStepper from "./coach-date-stepper";
import CoachHourlyDayView from "./coach-hourly-day-view";
import CoachSlotDurationChips from "./coach-slot-duration-chips";
import CoachStartEndSummary from "./coach-start-end-summary";
import {
  type CoachSlotDuration,
  type HourRange,
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

          <div>
            <p className="mb-1 text-xs text-ink/70">日期</p>
            <CoachDateStepper value={selectedDay} onChange={onDayChange} />
          </div>

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
            <CoachStartEndSummary startHour={startHour} durationHours={durationHours} />
            <CoachSlotDurationChips
              name="coach-slot-duration"
              startHour={startHour}
              durationHours={durationHours}
              occupiedRanges={occupiedRanges}
              onChange={onDurationChange}
              legend="時長（點選時段後揀）"
            />
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
