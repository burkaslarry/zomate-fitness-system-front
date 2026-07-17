"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Google Calendar-style day timeline (9:00–19:00)
 * Logic: Vertical hour rows; occupied blocks from dayCourses; tap free slot to pick start time.
 */

import {
  COACH_SLOT_DURATIONS,
  type CoachSlotDuration,
  type HourRange,
  firstFittingDuration,
  formatTimeRange,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

const ROW_PX = 52;

export type CoachDayCourse = {
  id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: { student_id: number; student_name: string }[];
};

type Props = {
  hours: readonly number[];
  dayCourses: CoachDayCourse[];
  occupiedRanges: HourRange[];
  selectedStudentName: string | null;
  startHour: number;
  durationHours: CoachSlotDuration;
  onPickSlot: (hour: number, duration: CoachSlotDuration) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function durationHoursFromCourse(c: CoachDayCourse): number {
  const start = new Date(c.scheduled_start);
  const end = new Date(c.scheduled_end);
  const startH = start.getHours() + start.getMinutes() / 60;
  let endH = end.getHours() + end.getMinutes() / 60;
  if (endH <= startH) endH = startH + 1;
  return Math.max(0.5, endH - startH);
}

export default function CoachHourlyDayView({
  hours,
  dayCourses,
  occupiedRanges,
  selectedStudentName,
  startHour,
  durationHours,
  onPickSlot
}: Props) {
  const minHour = hours[0] ?? 9;
  const maxHour = (hours[hours.length - 1] ?? 18) + 1;
  const totalHeight = (maxHour - minHour) * ROW_PX;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-ink/10 bg-canvas">
      <div className="relative" style={{ height: totalHeight }}>
        {hours.map((h) => (
          <div
            key={`line-${h}`}
            className="absolute left-0 right-0 border-t border-ink/10"
            style={{ top: (h - minHour) * ROW_PX }}
          >
            <span className="absolute -top-2.5 left-2 w-14 text-right text-[10px] font-medium tabular-nums text-ink/45">
              {pad2(h)}:00
            </span>
          </div>
        ))}
        <div className="absolute bottom-0 left-0 right-0 border-t border-ink/10">
          <span className="absolute -top-2.5 left-2 w-14 text-right text-[10px] font-medium tabular-nums text-ink/45">
            {pad2(maxHour)}:00
          </span>
        </div>

        <div className="absolute bottom-0 left-16 right-2 top-0">
          {hours.map((h) => {
            const fit = firstFittingDuration(occupiedRanges, h);
            const enabled = Boolean(selectedStudentName) && fit != null;
            const isSelected = selectedStudentName != null && startHour === h;
            const blocked = !fit;
            return (
              <button
                key={`slot-${h}`}
                type="button"
                disabled={!enabled}
                title={
                  !selectedStudentName
                    ? "請先揀學員"
                    : blocked
                      ? "已佔用"
                      : `排程 ${pad2(h)}:00`
                }
                onClick={() => {
                  if (!selectedStudentName || !fit) return;
                  onPickSlot(h, fit);
                }}
                className={`absolute left-0 right-0 rounded-md border transition ${
                  isSelected
                    ? "z-20 border-primary bg-primary/20 ring-2 ring-primary/40"
                    : enabled
                      ? "z-10 border-transparent hover:border-primary/40 hover:bg-primary/8"
                      : blocked
                        ? "z-0 cursor-not-allowed border-transparent bg-ink/[0.03]"
                        : "z-0 cursor-not-allowed border-transparent"
                }`}
                style={{
                  top: (h - minHour) * ROW_PX + 2,
                  height: ROW_PX - 4
                }}
              >
                {enabled && !isSelected ? (
                  <span className="block truncate px-2 text-left text-[11px] font-medium text-black">
                    {pad2(h)}:00 可排程
                  </span>
                ) : null}
              </button>
            );
          })}

          {selectedStudentName && !slotWouldConflict(occupiedRanges, startHour, durationHours) ? (
            <div
              className="pointer-events-none absolute left-0 right-0 z-30 rounded-md border-2 border-dashed border-primary/70 bg-primary/10 px-2 py-1"
              style={{
                top: (startHour - minHour) * ROW_PX + 2,
                height: durationHours * ROW_PX - 4
              }}
            >
              <p className="truncate text-[11px] font-semibold text-ink">{selectedStudentName}</p>
              <p className="truncate text-[10px] text-ink/65">
                {formatTimeRange(startHour, durationHours)} · {durationHours}h
              </p>
            </div>
          ) : null}

          {dayCourses.map((c) => {
            const startH = new Date(c.scheduled_start).getHours();
            if (startH < minHour || startH >= maxHour) return null;
            const dur = durationHoursFromCourse(c);
            const names = c.enrollments.map((e) => e.student_name).join("、");
            return (
              <div
                key={c.id}
                className="pointer-events-none absolute left-0 right-0 z-[15] overflow-hidden rounded-md border border-sky-300/80 bg-sky-100 px-2 py-1 shadow-sm"
                style={{
                  top: (startH - minHour) * ROW_PX + 2,
                  height: dur * ROW_PX - 4
                }}
              >
                <p className="truncate text-[11px] font-semibold text-sky-950">{c.title}</p>
                <p className="truncate text-[10px] text-sky-900/75">{names}</p>
                <p className="text-[10px] text-sky-900/60">
                  {new Date(c.scheduled_start).toLocaleTimeString("zh-HK", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                  {" – "}
                  {new Date(c.scheduled_end).toLocaleTimeString("zh-HK", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            );
          })}
        </div>

        {!selectedStudentName ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-canvas/55 px-6 text-center backdrop-blur-[1px]">
            <p className="rounded-lg border border-ink/15 bg-surface px-4 py-3 text-sm font-medium text-ink/70 shadow-sm">
              👆 請先點選上方學員卡片，再喺日曆點選時段
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
