"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Tap prev/next date — no native date scroll picker on mobile
 */

import { formatDateLabel, shiftDay } from "../lib/coach-schedule-dates";

type Props = {
  value: string;
  onChange: (dateKey: string) => void;
  className?: string;
};

export default function CoachDateStepper({ value, onChange, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(shiftDay(value, -1))}
        className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-black shadow-none hover:bg-surface"
        aria-label="上一日"
      >
        ‹
      </button>
      <p className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-center text-sm font-semibold text-black">
        {formatDateLabel(value)}
      </p>
      <button
        type="button"
        onClick={() => onChange(shiftDay(value, 1))}
        className="shrink-0 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-black shadow-none hover:bg-surface"
        aria-label="下一日"
      >
        ›
      </button>
    </div>
  );
}
