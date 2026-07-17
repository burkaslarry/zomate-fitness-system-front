"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Day time slots — split 上午|下午 columns or vertical timeline
 */

import {
  type CoachSlotDuration,
  type HourRange,
  firstFittingDuration,
  formatTimeRange,
  slotWouldConflict
} from "../lib/coach-schedule-duration";

const ROW_PX = 52;
const MORNING_HOURS = [9, 10, 11, 12] as const;
const AFTERNOON_HOURS = [13, 14, 15, 16, 17, 18] as const;

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
  layout?: "timeline" | "split";
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

function courseAtHour(dayCourses: CoachDayCourse[], hour: number): CoachDayCourse | null {
  for (const c of dayCourses) {
    const startH = new Date(c.scheduled_start).getHours();
    if (startH === hour) return c;
  }
  return null;
}

type SlotButtonProps = {
  hour: number;
  selectedStudentName: string | null;
  occupiedRanges: HourRange[];
  startHour: number;
  durationHours: CoachSlotDuration;
  dayCourses: CoachDayCourse[];
  onPickSlot: (hour: number, duration: CoachSlotDuration) => void;
  compact?: boolean;
};

function SlotButton({
  hour,
  selectedStudentName,
  occupiedRanges,
  startHour,
  durationHours,
  dayCourses,
  onPickSlot,
  compact = false
}: SlotButtonProps) {
  const fit = firstFittingDuration(occupiedRanges, hour);
  const enabled = Boolean(selectedStudentName) && fit != null;
  const isSelected = selectedStudentName != null && startHour === hour;
  const blocked = !fit;
  const booked = courseAtHour(dayCourses, hour);

  return (
    <button
      type="button"
      disabled={!enabled}
      title={!selectedStudentName ? "請先揀學員" : blocked ? "已佔用" : `排程 ${pad2(hour)}:00`}
      onClick={() => {
        if (!selectedStudentName || !fit) return;
        onPickSlot(hour, fit);
      }}
      className={`w-full rounded-lg border text-left transition ${
        compact ? "px-2 py-2" : "px-2 py-2.5"
      } ${
        isSelected
          ? "border-primary bg-primary/20 ring-2 ring-primary/40 text-black"
          : enabled
            ? "border-ink/10 bg-canvas text-black hover:border-primary/40 hover:bg-primary/8"
            : "cursor-not-allowed border-transparent bg-ink/[0.04] text-ink/35"
      }`}
    >
      <span className={`block font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
        {pad2(hour)}:00
      </span>
      {booked ? (
        <span className="mt-0.5 block truncate text-[10px] text-sky-900/80">{booked.title}</span>
      ) : enabled && !isSelected ? (
        <span className="mt-0.5 block text-[10px] font-medium text-black/60">可排程</span>
      ) : isSelected ? (
        <span className="mt-0.5 block text-[10px] text-black/70">
          {formatTimeRange(startHour, durationHours)}
        </span>
      ) : blocked && !booked ? (
        <span className="mt-0.5 block text-[10px]">已佔用</span>
      ) : null}
    </button>
  );
}

function SplitDayView(props: Omit<Props, "layout" | "hours">) {
  const {
    dayCourses,
    occupiedRanges,
    selectedStudentName,
    startHour,
    durationHours,
    onPickSlot
  } = props;

  const slotProps = {
    selectedStudentName,
    occupiedRanges,
    startHour,
    durationHours,
    dayCourses,
    onPickSlot
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-canvas p-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1.5 text-center text-[11px] font-semibold text-black/70">上午</p>
          <div className="space-y-1">
            {MORNING_HOURS.map((h) => (
              <SlotButton key={h} hour={h} compact {...slotProps} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-center text-[11px] font-semibold text-black/70">下午</p>
          <div className="space-y-1">
            {AFTERNOON_HOURS.map((h) => (
              <SlotButton key={h} hour={h} compact {...slotProps} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineDayView({
  hours,
  dayCourses,
  occupiedRanges,
  selectedStudentName,
  startHour,
  durationHours,
  onPickSlot
}: Omit<Props, "layout">) {
  const minHour = hours[0] ?? 9;
  const maxHour = (hours[hours.length - 1] ?? 18) + 1;
  const totalHeight = (maxHour - minHour) * ROW_PX;

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-canvas">
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
                  !selectedStudentName ? "請先揀學員" : blocked ? "已佔用" : `排程 ${pad2(h)}:00`
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
              <p className="truncate text-[11px] font-semibold text-black">{selectedStudentName}</p>
              <p className="truncate text-[10px] text-black/65">
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
              </div>
            );
          })}
        </div>

        {!selectedStudentName ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-canvas/55 px-6 text-center backdrop-blur-[1px]">
            <p className="rounded-lg border border-ink/15 bg-surface px-4 py-3 text-sm font-medium text-ink/70 shadow-sm">
              👆 請先點選上方學員卡片
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CoachHourlyDayView({ layout = "timeline", hours, ...rest }: Props) {
  if (layout === "split") {
    return <SplitDayView {...rest} />;
  }
  return <TimelineDayView hours={hours} {...rest} />;
}
