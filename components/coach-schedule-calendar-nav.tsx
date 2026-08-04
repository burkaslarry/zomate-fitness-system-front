"use client";

/**
 * [F003][S002]
 * Feature: Coach Dashboard
 * Step: Google Calendar–style week / month grid — up to 5 session chips per day + overflow
 */

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
import {
  calendarCellPreview,
  calendarChipClass,
  calendarChipLabel,
  type CoachSessionRow
} from "../lib/coach-sessions";

export type CalendarMode = "week" | "month";

const MAX_VISIBLE = 5;
const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

type Props = {
  selectedDay: string;
  mode: CalendarMode;
  rangeSessions: CoachSessionRow[];
  onSelectDay: (dateKey: string) => void;
  onModeChange: (mode: CalendarMode) => void;
  onNavigate: (nextAnchorDay: string) => void;
};

function DaySessionChips({ sessions, dayKey }: { sessions: CoachSessionRow[]; dayKey: string }) {
  const { visible, overflow } = calendarCellPreview(sessions, dayKey, MAX_VISIBLE, { confirmedOnly: true });
  if (visible.length === 0) return null;

  return (
    <div className="mt-1 w-full space-y-0.5 px-0.5">
      {visible.map((s) => (
        <div
          key={`${s.enrollment_id}-${s.session_date}`}
          className={`truncate rounded border px-1 py-px text-left text-[9px] font-semibold leading-tight md:text-[10px] ${calendarChipClass(s.student_id)}`}
          title={calendarChipLabel(s)}
        >
          {calendarChipLabel(s)}
        </div>
      ))}
      {overflow > 0 ? (
        <p className="px-0.5 text-left text-[9px] font-semibold text-ink/55 md:text-[10px]">+{overflow} 更多</p>
      ) : null}
    </div>
  );
}

function DayNumber({
  dayKey,
  selectedDay,
  today
}: {
  dayKey: string;
  selectedDay: string;
  today: string;
}) {
  const d = parseDateKey(dayKey);
  const isToday = dayKey === today;
  const active = dayKey === selectedDay;

  if (isToday && !active) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-black">
        {d.getDate()}
      </span>
    );
  }

  return <span className={`text-xs font-semibold ${active ? "text-black" : "text-black/85"}`}>{d.getDate()}</span>;
}

export default function CoachScheduleCalendarNav({
  selectedDay,
  mode,
  rangeSessions,
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

  const dayButtonClass = (dayKey: string, inMonth = true) => {
    const active = dayKey === selectedDay;
    const past = isPastDay(dayKey, today);
    const base =
      "flex min-h-[5.5rem] w-full flex-col items-stretch rounded-lg border px-0.5 py-1 text-left transition md:min-h-[6.25rem]";
    if (active) {
      return `${base} border-primary bg-primary/10 ring-2 ring-primary/35 shadow-sm`;
    }
    if (past) {
      return `${base} border-ink/10 bg-ink/[0.03] text-black/45 hover:border-ink/20 ${inMonth ? "" : "opacity-35"}`;
    }
    return `${base} border-ink/10 bg-canvas hover:border-primary/25 hover:bg-surface ${inMonth ? "" : "opacity-40"}`;
  };

  return (
    <div className="space-y-2">
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

      <p className="text-[11px] text-ink/50">
        已選：<span className="font-medium text-ink/70">{formatDateLabel(selectedDay)}</span>
        {" · "}
        點日期查看當日學員；最多顯示 {MAX_VISIBLE} 堂，其餘以「+N 更多」表示
      </p>

      {mode === "week" ? (
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-ink/45">
            {weekDaysContaining(selectedDay).map((dayKey) => (
              <span key={`wh-${dayKey}`}>{weekdayLabel(dayKey)}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDaysContaining(selectedDay).map((dayKey) => (
              <button
                key={dayKey}
                type="button"
                onClick={() => onSelectDay(dayKey)}
                className={dayButtonClass(dayKey)}
              >
                <div className="flex justify-center">
                  <DayNumber dayKey={dayKey} selectedDay={selectedDay} today={today} />
                </div>
                <DaySessionChips sessions={rangeSessions} dayKey={dayKey} />
              </button>
            ))}
          </div>
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
                    return <div key={`pad-${ri}-${ci}`} className="min-h-[5.5rem] md:min-h-[6.25rem]" />;
                  }
                  const inMonth = parseDateKey(dayKey).getMonth() === parseDateKey(selectedDay).getMonth();
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => onSelectDay(dayKey)}
                      className={dayButtonClass(dayKey, inMonth)}
                    >
                      <div className="flex justify-center">
                        <DayNumber dayKey={dayKey} selectedDay={selectedDay} today={today} />
                      </div>
                      <DaySessionChips sessions={rangeSessions} dayKey={dayKey} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink/45">灰色日期＝已過 · 只可查閱；今日起可按 + 新增排程</p>
    </div>
  );
}
