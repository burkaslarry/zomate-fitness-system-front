"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Schedule slot picker modal (9:00–19:00)
 * Logic: Opens after student/day click; hourly timeline + confirm in popup.
 */

import CoachHourlyDayView, { type CoachDayCourse } from "./coach-hourly-day-view";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type Props = {
  open: boolean;
  studentName: string;
  courseTitle: string;
  selectedDay: string;
  dayCourses: CoachDayCourse[];
  excludeCourseIds: Set<number>;
  occupied: Set<number>;
  startHour: number;
  durationHours: 1 | 2;
  scheduling: boolean;
  onClose: () => void;
  onDayChange: (day: string) => void;
  onPickSlot: (hour: number, duration: 1 | 2) => void;
  onStartHourChange: (hour: number) => void;
  onDurationChange: (hours: 1 | 2) => void;
  onConfirm: () => void;
  slotWouldConflict: (occupied: Set<number>, startHour: number, durationHours: number) => boolean;
};

export default function CoachScheduleModal({
  open,
  studentName,
  courseTitle,
  selectedDay,
  dayCourses,
  excludeCourseIds,
  occupied,
  startHour,
  durationHours,
  scheduling,
  onClose,
  onDayChange,
  onPickSlot,
  onStartHourChange,
  onDurationChange,
  onConfirm,
  slotWouldConflict
}: Props) {
  if (!open) return null;

  const conflict = slotWouldConflict(occupied, startHour, durationHours);

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
            正在為 <strong className="text-ink">{studentName}</strong> 排程 · {courseTitle} · 點選空白時段（1–2 小時）
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
            excludeCourseIds={excludeCourseIds}
            occupied={occupied}
            selectedStudentName={studentName}
            startHour={startHour}
            durationHours={durationHours}
            slotWouldConflict={slotWouldConflict}
            onPickSlot={onPickSlot}
          />

          <div className="flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4">
            <label className="text-xs text-ink/70">
              開始
              <select
                value={startHour}
                onChange={(e) => onStartHourChange(Number(e.target.value))}
                className="mt-1 block min-w-[5.5rem] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm"
              >
                {HOURS.filter((h) => !slotWouldConflict(occupied, h, durationHours)).map((h) => (
                  <option key={h} value={h}>
                    {pad2(h)}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink/70">
              時長
              <select
                value={durationHours}
                onChange={(e) => onDurationChange(Number(e.target.value) as 1 | 2)}
                className="mt-1 block min-w-[5.5rem] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm"
              >
                {[1, 2].filter((d) => !slotWouldConflict(occupied, startHour, d)).map((d) => (
                  <option key={d} value={d}>
                    {d} 小時
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={scheduling || conflict}
              onClick={onConfirm}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {scheduling ? "提交中…" : "確認排程"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
