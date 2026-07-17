"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Show start → end time after slot selection
 */

import { formatHourMinute } from "../lib/coach-schedule-duration";

type Props = {
  startHour: number;
  durationHours: number;
};

export default function CoachStartEndSummary({ startHour, durationHours }: Props) {
  const endHour = startHour + durationHours;
  return (
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
  );
}
