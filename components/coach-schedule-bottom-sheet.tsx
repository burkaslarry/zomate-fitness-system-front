"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Schedule bottom sheet — date, dropdown start time (15-min), duration, occupied list
 */

import CoachBottomSheet from "./coach-bottom-sheet";
import CoachDateStepper from "./coach-date-stepper";
import CoachSlotDurationSelect from "./coach-slot-duration-select";
import CoachStartTimeSelect from "./coach-start-time-select";
import {
  type CoachSlotDuration,
  type CoachStartMinute,
  type HourRange,
  formatHourMinute,
  slotWouldConflict,
  startSlotDecimal
} from "../lib/coach-schedule-duration";
import { isPastDay, todayDateKey } from "../lib/coach-schedule-dates";

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
  startMinute: CoachStartMinute;
  durationHours: CoachSlotDuration;
  scheduling: boolean;
  onClose: () => void;
  onDayChange: (day: string) => void;
  onStartTimeChange: (hour: number, minute: CoachStartMinute) => void;
  onDurationChange: (hours: CoachSlotDuration) => void;
  onConfirm: () => void;
};

function formatCourseLine(c: DayCourse): string {
  const time = new Date(c.scheduled_start).toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const end = new Date(c.scheduled_end).toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const names = c.enrollments.map((e) => e.student_name).join("、");
  return `${time}–${end} · ${c.title} · ${names}`;
}

export default function CoachScheduleBottomSheet({
  open,
  studentName,
  courseTitle,
  selectedDay,
  dayCourses,
  occupiedRanges,
  startHour,
  startMinute,
  durationHours,
  scheduling,
  onClose,
  onDayChange,
  onStartTimeChange,
  onDurationChange,
  onConfirm
}: Props) {
  const startDecimal = startSlotDecimal(startHour, startMinute);
  const endDecimal = startDecimal + durationHours;
  const conflict = slotWouldConflict(occupiedRanges, startDecimal, durationHours);

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
            已揀 <strong>{studentName}</strong> · {courseTitle}
          </p>

          <div>
            <p className="mb-1 text-xs font-medium text-ink/70">日期</p>
            <CoachDateStepper
              value={selectedDay}
              onChange={onDayChange}
              minDate={todayDateKey()}
            />
          </div>

          <CoachStartTimeSelect
            startHour={startHour}
            startMinute={startMinute}
            durationHours={durationHours}
            occupiedRanges={occupiedRanges}
            onChange={onStartTimeChange}
          />

          <div className="rounded-xl border border-ink/10 bg-canvas p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[4.5rem]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">開始</p>
                <p className="text-base font-semibold tabular-nums text-black">
                  {formatHourMinute(startDecimal)}
                </p>
              </div>
              <span className="text-lg text-ink/25" aria-hidden>
                →
              </span>
              <div className="min-w-[4.5rem]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink/50">結束</p>
                <p className="text-base font-semibold tabular-nums text-black">
                  {formatHourMinute(endDecimal)}
                </p>
              </div>
              <div className="min-w-[6.5rem] flex-1">
                <CoachSlotDurationSelect
                  startHour={startDecimal}
                  durationHours={durationHours}
                  occupiedRanges={occupiedRanges}
                  onChange={onDurationChange}
                />
              </div>
            </div>
          </div>

          {dayCourses.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink/70">此日已排課程</p>
              <ul className="space-y-1.5 text-xs text-ink/75">
                {dayCourses.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-ink/10 bg-canvas/70 px-3 py-2"
                  >
                    {formatCourseLine(c)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-ink/45">此日暫無其他已排課程。</p>
          )}
        </div>

        <div className="shrink-0 border-t border-ink/10 bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={scheduling || conflict || isPastDay(selectedDay)}
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
