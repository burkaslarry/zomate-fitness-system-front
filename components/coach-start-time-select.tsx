"use client";

/**
 * [F003][S011]
 * Feature: Coach Dashboard
 * Step: Flexible start time — hour + minute (00/15/30/45) dropdowns
 */

import {
  COACH_SLOT_DURATIONS,
  COACH_START_HOURS,
  COACH_START_MINUTES,
  type CoachStartMinute,
  type HourRange,
  slotWouldConflict,
  startSlotDecimal
} from "../lib/coach-schedule-duration";

type Props = {
  startHour: number;
  startMinute: CoachStartMinute;
  durationHours: number;
  occupiedRanges: HourRange[];
  onChange: (hour: number, minute: CoachStartMinute) => void;
  disabled?: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CoachStartTimeSelect({
  startHour,
  startMinute,
  durationHours,
  occupiedRanges,
  onChange,
  disabled = false
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-ink/70">
        開始 · 鐘數
        <select
          value={startHour}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value), startMinute)}
          className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2.5 text-sm font-semibold text-black"
        >
          {COACH_START_HOURS.map((h) => (
            <option key={h} value={h}>
              {pad2(h)} 時
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ink/70">
        開始 · 分鐘
        <select
          value={startMinute}
          disabled={disabled}
          onChange={(e) => onChange(startHour, Number(e.target.value) as CoachStartMinute)}
          className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2.5 text-sm font-semibold text-black"
        >
          {COACH_START_MINUTES.map((m) => {
            const slot = startSlotDecimal(startHour, m);
            const blocked = !COACH_SLOT_DURATIONS.some(
              (d) => !slotWouldConflict(occupiedRanges, slot, d)
            );
            return (
              <option key={m} value={m} disabled={blocked}>
                :{pad2(m)}
                {blocked ? "（不可用）" : ""}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}
