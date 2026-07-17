"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Collapsible week / month calendar — collapse after date pick to reveal slots
 * Logic: isCalendarExpanded; grid-row animation; auto-scroll to schedule anchor.
 */

import { useCallback, useState, type RefObject } from "react";
import {
  formatDateKey,
  formatDateLabel,
  isPastDay,
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
  /** Scroll target below calendar (time-slot CTA) after collapse */
  scrollAnchorRef?: RefObject<HTMLElement | null>;
};

const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];
const COLLAPSE_MS = 320;

export default function CoachScheduleCalendarNav({
  selectedDay,
  mode,
  sessionCountsByDay,
  onSelectDay,
  onModeChange,
  onNavigate,
  scrollAnchorRef
}: Props) {
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

  const today = formatDateKey(new Date());
  const periodTitle = mode === "week" ? weekTitle(selectedDay) : monthTitle(selectedDay);

  const scrollToScheduleAnchor = useCallback(() => {
    window.setTimeout(() => {
      scrollAnchorRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, COLLAPSE_MS);
  }, [scrollAnchorRef]);

  const pickDay = useCallback(
    (dayKey: string) => {
      onSelectDay(dayKey);
      setIsCalendarExpanded(false);
      scrollToScheduleAnchor();
    },
    [onSelectDay, scrollToScheduleAnchor]
  );

  const goPrev = () => {
    onNavigate(mode === "week" ? shiftWeek(selectedDay, -1) : shiftMonth(selectedDay, -1));
  };
  const goNext = () => {
    onNavigate(mode === "week" ? shiftWeek(selectedDay, 1) : shiftMonth(selectedDay, 1));
  };

  return (
    <div className="mt-2 space-y-2">
      {!isCalendarExpanded ? (
        <button
          type="button"
          onClick={() => setIsCalendarExpanded(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left text-sm font-medium text-black shadow-sm transition hover:bg-primary/20 active:scale-[0.99]"
        >
          <span aria-hidden>🗓️</span>
          <span className="min-w-0 flex-1 truncate">
            已選：{formatDateLabel(selectedDay)}
            <span className="ml-1 text-xs font-normal text-black/55">（點擊展開日曆）</span>
          </span>
        </button>
      ) : null}

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isCalendarExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 pb-1">
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
            const past = isPastDay(dayKey, today);
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => pickDay(dayKey)}
                className={`flex flex-col items-center rounded-lg border py-2 text-center transition ${
                  active
                    ? past
                      ? "border-ink/25 bg-ink/10 ring-1 ring-ink/20 text-black"
                      : "border-primary bg-primary/15 ring-1 ring-primary/35 text-black"
                    : past
                      ? "border-ink/10 bg-ink/[0.04] text-black/45 hover:border-ink/25"
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
                  const past = isPastDay(dayKey, today);
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => pickDay(dayKey)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-center transition ${
                        active
                          ? past
                            ? "border-ink/25 bg-ink/10 ring-1 ring-ink/20 text-black"
                            : "border-primary bg-primary/15 ring-1 ring-primary/35 text-black"
                          : past
                            ? "border-ink/10 bg-ink/[0.04] text-black/45 hover:border-ink/25"
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

            {isCalendarExpanded ? (
              <p className="text-[11px] text-ink/50">
                灰色日期＝已過 · 只可查閱上堂；今日起可排新期
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
