"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Main-view trigger + unified schedule bottom sheet
 */

import CoachScheduleBottomSheet from "./coach-schedule-bottom-sheet";
import { type CoachSlotDuration, type HourRange } from "../lib/coach-schedule-duration";

type Props = {
  studentName: string;
  courseTitle: string;
  selectedDay: string;
  dayCourses: {
    id: number;
    title: string;
    scheduled_start: string;
    scheduled_end: string;
    enrollments: { student_id: number; student_name: string }[];
  }[];
  occupiedRanges: HourRange[];
  startHour: number;
  durationHours: CoachSlotDuration;
  sheetOpen: boolean;
  scheduling: boolean;
  onOpenSheet: () => void;
  onDayChange: (day: string) => void;
  onPickSlot: (hour: number, duration: CoachSlotDuration) => void;
  onCloseSheet: () => void;
  onDurationChange: (hours: CoachSlotDuration) => void;
  onConfirm: () => void;
};

export default function CoachSchedulePanel({
  studentName,
  courseTitle,
  selectedDay,
  dayCourses,
  occupiedRanges,
  startHour,
  durationHours,
  sheetOpen,
  scheduling,
  onOpenSheet,
  onDayChange,
  onPickSlot,
  onCloseSheet,
  onDurationChange,
  onConfirm
}: Props) {
  return (
    <>
      <div className="mt-3 border-t border-ink/10 pt-4">
        <button
          type="button"
          onClick={onOpenSheet}
          className="w-full rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-left text-sm font-semibold text-black shadow-sm transition hover:bg-primary/25 active:scale-[0.99]"
        >
          <span className="block text-xs font-medium text-black/60">已揀學員 · 一鍵排程</span>
          <span className="mt-0.5 block">
            {studentName} · {courseTitle}
          </span>
          <span className="mt-1 block text-xs font-medium text-black/70">揀時段排程 →</span>
        </button>
      </div>

      <CoachScheduleBottomSheet
        open={sheetOpen}
        studentName={studentName}
        courseTitle={courseTitle}
        selectedDay={selectedDay}
        dayCourses={dayCourses}
        occupiedRanges={occupiedRanges}
        startHour={startHour}
        durationHours={durationHours}
        scheduling={scheduling}
        onClose={onCloseSheet}
        onDayChange={onDayChange}
        onPickSlot={onPickSlot}
        onDurationChange={onDurationChange}
        onConfirm={onConfirm}
      />
    </>
  );
}
