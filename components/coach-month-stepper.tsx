"use client";

/**
 * [F008][S004]
 * Feature: Coach Session Management
 * Step: Tap prev/next month — no native month scroll picker on mobile
 */

import { formatMonthLabel, shiftMonthValue } from "../lib/coach-schedule-dates";

type Props = {
  value: string;
  onChange: (monthKey: string) => void;
  className?: string;
};

export default function CoachMonthStepper({ value, onChange, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(shiftMonthValue(value, -1))}
        className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-black shadow-none hover:bg-surface"
        aria-label="上一月"
      >
        ‹
      </button>
      <p className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-center text-sm font-semibold text-black">
        {formatMonthLabel(value)}
      </p>
      <button
        type="button"
        onClick={() => onChange(shiftMonthValue(value, 1))}
        className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-black shadow-none hover:bg-surface"
        aria-label="下一月"
      >
        ›
      </button>
    </div>
  );
}
