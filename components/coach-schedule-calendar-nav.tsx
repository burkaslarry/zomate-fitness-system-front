"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Week / month calendar picker (not single-day-only)
 * Logic: Toggle 週|月; pick day → hourly timeline below.
 */

import {
  formatDateKey,
  monthGrid,
  monthTitle,
  parseDateKey,
  shiftMonth,
  shiftWeek,
  weekDaysContaining,
  weekTitle,
  weekdayLabel
} from "../lib/coach-schedule-dates";

export type CalendarMode = "week" | "month";

type Props = {
  selectedDay: string;
  mode: CalendarMode;
  sessionCountsByDay: Record<string, number>;
  onSelectDay: (dateKey: string) => void;
  onModeChange: (mode: CalendarMode) => void;
  onNavigate: (nextAnchorDay: string) => void;
};

const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

export default function CoachScheduleCalendarNav({
  selectedDay,
  mode,
  sessionCountsByDay,
  onSelectDay,
  onModeChange,
  onNavigate
}: Props) {
  const today = formatDateKey(new Date());
  const periodTitle = mode === "week" ? weekTitle(selectedDay) : monthTitle(selectedDay);

  const goPrev = () => {
    onNavigate(mode === "week" ? shiftWeek(selectedDay, -1) : shiftMonth(selectedDay, -1));
  };
  const goNext = () => {
    onNavigate(mode === "week" ? shiftWeek(selectedDay, 1) : shiftMonth(selectedDay, 1));
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-ink/15 bg-canvas p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onModeChange("week")}
            className={`rounded-md border-0 px-3 py-1.5 shadow-none transition ${
              mode === "week" ? "bg-primary text-black" : "bg-transparent text-black/70 hover:text-black"
            }`}
          >
            週
          </button>
          <button
            type="button"
            onClick={() => onModeChange("month")}
            className={`rounded-md border-0 px-3 py-1.5 shadow-none transition ${
              mode === "month" ? "bg-primary text-black" : "bg-transparent text-black/70 hover:text-black"
            }`}
          >
            月
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-ink/15 bg-canvas px-2 py-1 text-sm text-black shadow-none hover:bg-surface"
            aria-label="上一段"
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center text-xs font-medium text-black/80">{periodTitle}</span>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-ink/15 bg-canvas px-2 py-1 text-sm text-black shadow-none hover:bg-surface"
            aria-label="下一段"
          >
            ›
          </button>
        </div>
      </div>

      {mode === "week" ? (
        <div className="grid grid-cols-7 gap-1">
          {weekDaysContaining(selectedDay).map((dayKey) => {
            const d = parseDateKey(dayKey);
            const active = dayKey === selectedDay;
            const isToday = dayKey === today;
            const count = sessionCountsByDay[dayKey] ?? 0;
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => onSelectDay(dayKey)}
                className={`flex flex-col items-center rounded-lg border py-2 text-center transition ${
                  active
                    ? "border-primary bg-primary/15 ring-1 ring-primary/35 text-black"
                    : "border-ink/10 bg-canvas text-black hover:border-primary/30"
                }`}
              >
                <span className="text-[10px] text-black/50">{weekdayLabel(dayKey)}</span>
                <span
                  className={`mt-0.5 text-sm font-semibold ${isToday && !active ? "text-black/80" : "text-black"}`}
                >
                  {d.getDate()}
                </span>
                {count > 0 ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-label={`${count} 堂`} />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-ink/45">
            {WEEKDAY_HEADERS.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div className="space-y-1">
            {monthGrid(selectedDay).map((row, ri) => (
              <div key={`row-${ri}`} className="grid grid-cols-7 gap-1">
                {row.map((dayKey, ci) => {
                  if (!dayKey) {
                    return <div key={`pad-${ri}-${ci}`} className="aspect-square" />;
                  }
                  const d = parseDateKey(dayKey);
                  const active = dayKey === selectedDay;
                  const isToday = dayKey === today;
                  const count = sessionCountsByDay[dayKey] ?? 0;
                  const inMonth = d.getMonth() === parseDateKey(selectedDay).getMonth();
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => onSelectDay(dayKey)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-center transition ${
                        active
                          ? "border-primary bg-primary/15 ring-1 ring-primary/35 text-black"
                          : "border-ink/10 bg-canvas text-black hover:border-primary/30"
                      } ${inMonth ? "" : "opacity-40"}`}
                    >
                      <span
                        className={`text-xs font-semibold ${isToday && !active ? "text-black/80" : "text-black"}`}
                      >
                        {d.getDate()}
                      </span>
                      {count > 0 ? (
                        <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink/50">
        已選 {selectedDay} · 揀學員後點日期開啟 9:00–19:00 排程視窗
      </p>
    </div>
  );
}
