"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Start-hour tap chips — no select dropdown on mobile
 */

import {
  COACH_SLOT_DURATIONS,
  type HourRange,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type Props = {
  name: string;
  hours: readonly number[];
  startHour: number;
  occupiedRanges: HourRange[];
  onChange: (hour: number) => void;
  legend?: string;
};

export default function CoachStartHourChips({
  name,
  hours,
  startHour,
  occupiedRanges,
  onChange,
  legend = "開始時間"
}: Props) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-ink/70">{legend}</legend>
      <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {hours.map((h) => {
          const available = COACH_SLOT_DURATIONS.some((d) => !slotWouldConflict(occupiedRanges, h, d));
          const checked = startHour === h;
          return (
            <label
              key={h}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-1 py-2 text-center text-xs font-semibold tabular-nums transition sm:text-sm ${
                checked
                  ? "border-primary bg-primary text-black ring-1 ring-primary/35"
                  : !available
                    ? "cursor-not-allowed border-ink/10 bg-ink/[0.04] text-ink/30"
                    : "border-ink/15 bg-surface text-black hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={h}
                checked={checked}
                disabled={!available}
                onChange={() => onChange(h)}
                className="sr-only"
              />
              {pad2(h)}:00
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
