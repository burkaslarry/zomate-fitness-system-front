"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Duration radio chips (0.5 / 1 / 1.5 / 2 h) — mobile-friendly
 */

import {
  COACH_SLOT_DURATIONS,
  type CoachSlotDuration,
  type HourRange,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

export function durationChipLabel(hours: CoachSlotDuration): string {
  if (hours === 0.5) return "0.5 hr";
  if (hours === 1.5) return "1.5 hr";
  return `${hours} hr`;
}

type Props = {
  name: string;
  startHour: number;
  durationHours: CoachSlotDuration;
  occupiedRanges: HourRange[];
  onChange: (hours: CoachSlotDuration) => void;
  legend?: string;
};

export default function CoachSlotDurationChips({
  name,
  startHour,
  durationHours,
  occupiedRanges,
  onChange,
  legend = "時長"
}: Props) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-ink/70">{legend}</legend>
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
                name={name}
                value={d}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(d)}
                className="sr-only"
              />
              {durationChipLabel(d)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
