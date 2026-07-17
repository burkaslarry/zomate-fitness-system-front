"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: All-in-one schedule bottom sheet — date, time range, duration, AM/PM slots
 */

import CoachBottomSheet from "./coach-bottom-sheet";
import CoachDateStepper from "./coach-date-stepper";
import CoachHourlyDayView from "./coach-hourly-day-view";
import CoachSlotDurationSelect from "./coach-slot-duration-select";
import { useEffect, useState } from "react";
import {
  COACH_SLOT_DURATIONS,
  type CoachSlotDuration,
  type HourRange,
  firstFittingDuration,
  formatHourMinute,
  slotWouldConflict
} from "../lib/coach-schedule-duration";
import { isPastDay, todayDateKey } from "../lib/coach-schedule-dates";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

type DayCourse = {
  id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: { student_id: number; student_name: string }[];
};

type Props = {
  open: boolean;
  studentName: string;
  courseTitle: string;
  selectedDay: string;
  dayCourses: DayCourse[];
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

export default function CoachScheduleBottomSheet({
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
  const conflict = slotWouldConflict(occupiedRanges, startHour, durationHours);
  const [slotPicked, setSlotPicked] = useState(false);

  useEffect(() => {
    if (!open) setSlotPicked(false);
  }, [open]);

  useEffect(() => {
    setSlotPicked(false);
  }, [selectedDay]);

  function handlePickSlot(hour: number, _suggested: CoachSlotDuration) {
    setSlotPicked(true);
    const prefer = slotWouldConflict(occupiedRanges, hour, durationHours)
      ? firstFittingDuration(occupiedRanges, hour, [...COACH_SLOT_DURATIONS])
      : durationHours;
    const dur = prefer ?? durationHours;
    onPickSlot(hour, dur);
    if (dur !== durationHours) onDurationChange(dur);
  }

  function handleDurationChange(d: CoachSlotDuration) {
    onDurationChange(d);
  }

  const endHour = startHour + durationHours;

  return (
    <CoachBottomSheet
      open={open}
      onClose={onClose}
      title="揀時段排程"
      ariaLabelledBy="coach-schedule-sheet-title"
      heightClass="h-[min(88vh,720px)] max-h-[88vh]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
          <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-black">
            已揀 <strong>{studentName}</strong> · {courseTitle} · 點空白時段排程
          </p>

          <div>
            <p className="mb-1 text-xs font-medium text-ink/70">日期</p>
            <CoachDateStepper
              value={selectedDay}
              onChange={onDayChange}
              minDate={todayDateKey()}
            />
          </div>

          <div className="rounded-xl border border-ink/10 bg-canvas p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[4.5rem]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">開始</p>
                <p className="text-base font-semibold tabular-nums text-black">
                  {slotPicked ? formatHourMinute(startHour) : "—"}
                </p>
              </div>
              <span className="text-lg text-ink/25" aria-hidden>
                →
              </span>
              <div className="min-w-[4.5rem]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">結束</p>
                <p className="text-base font-semibold tabular-nums text-black">
                  {slotPicked ? formatHourMinute(endHour) : "—"}
                </p>
              </div>
              <div className="min-w-[6.5rem] flex-1">
                <CoachSlotDurationSelect
                  startHour={slotPicked ? startHour : (HOURS[0] ?? 9)}
                  durationHours={durationHours}
                  occupiedRanges={occupiedRanges}
                  onChange={handleDurationChange}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink/70">時段</p>
            <CoachHourlyDayView
              layout="split"
              hours={HOURS}
              dayCourses={dayCourses}
              occupiedRanges={occupiedRanges}
              selectedStudentName={studentName}
              startHour={startHour}
              durationHours={durationHours}
              onPickSlot={handlePickSlot}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-ink/10 bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={scheduling || conflict || !slotPicked || isPastDay(selectedDay)}
            onClick={onConfirm}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {scheduling ? "提交中…" : "確認排程"}
          </button>
        </div>
      </div>
    </CoachBottomSheet>
  );
}
