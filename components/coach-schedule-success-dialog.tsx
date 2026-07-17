"use client";

/**
 * [F003][S010]
 * Feature: Coach Dashboard
 * Step: Post-schedule success dialog — redirect to 學員 tab
 */

import { formatHourMinute } from "../lib/coach-schedule-duration";

type Props = {
  open: boolean;
  studentName: string;
  courseTitle: string;
  day: string;
  startHour: number;
  durationHours: number;
  onGoStudents: () => void;
};

function formatDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

export default function CoachScheduleSuccessDialog({
  open,
  studentName,
  courseTitle,
  day,
  startHour,
  durationHours,
  onGoStudents
}: Props) {
  if (!open) return null;

  const endHour = startHour + durationHours;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-schedule-success-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-surface p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">排期成功</p>
        <h2 id="coach-schedule-success-title" className="mt-2 text-lg font-semibold text-ink">
          {studentName}
        </h2>
        <p className="mt-1 text-sm text-ink/70">{courseTitle}</p>
        <p className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          {formatDayLabel(day)}
          <br />
          {formatHourMinute(startHour)} → {formatHourMinute(endHour)}
        </p>
        <button
          type="button"
          onClick={onGoStudents}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-black"
        >
          查看學員
        </button>
      </div>
    </div>
  );
}
