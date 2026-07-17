"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Duration dropdown (0.5 / 1 / 1.5 / 2 h)
 */

import {
  COACH_SLOT_DURATIONS,
  type CoachSlotDuration,
  type HourRange,
  formatDurationLabel,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

type Props = {
  startHour: number;
  durationHours: CoachSlotDuration;
  occupiedRanges: HourRange[];
  onChange: (hours: CoachSlotDuration) => void;
  disabled?: boolean;
  legend?: string;
};

export default function CoachSlotDurationSelect({
  startHour,
  durationHours,
  occupiedRanges,
  onChange,
  disabled = false,
  legend = "時長"
}: Props) {
  const options = COACH_SLOT_DURATIONS.filter(
    (d) => !slotWouldConflict(occupiedRanges, startHour, d)
  );

  return (
    <label className="block text-xs font-medium text-ink/70">
      {legend}
      <select
        value={durationHours}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(Number(e.target.value) as CoachSlotDuration)}
        className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2.5 text-sm font-semibold text-black"
      >
        {COACH_SLOT_DURATIONS.map((d) => {
          const blocked = slotWouldConflict(occupiedRanges, startHour, d);
          return (
            <option key={d} value={d} disabled={blocked}>
              {d === 0.5 ? "0.5 hr" : d === 1.5 ? "1.5 hr" : `${d} hr`}
              {blocked ? "（不可用）" : ""}
            </option>
          );
        })}
      </select>
      {!disabled && options.length > 0 ? (
        <span className="mt-0.5 block text-[10px] text-ink/45">{formatDurationLabel(durationHours)}</span>
      ) : null}
    </label>
  );
}
