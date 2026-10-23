"use client";

/** [F008][S005] Google Calendar-style day/week time grid and full month appointments. */
import { useState } from "react";
import { formatDateKey, formatDateLabel, monthGrid, monthTitle, parseDateKey, shiftDay, shiftMonth, shiftWeek, weekDaysContaining, weekTitle } from "../lib/coach-schedule-dates";
import { calendarChipClass, type CoachSessionRow } from "../lib/coach-sessions";

export type CalendarMode = "day" | "week" | "month";
type Props = {
  selectedDay: string; mode: CalendarMode; rangeSessions: CoachSessionRow[];
  onSelectDay: (day: string) => void; onModeChange: (mode: CalendarMode) => void;
  onNavigate: (day: string) => void;
};

/** [F008][S005] Convert a wall-clock label into minutes for stable time-grid positioning. */
function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** [F008][S005] Keep overlapping lessons in separate lanes instead of hiding events. */
function eventLanes(rows: CoachSessionRow[]) {
  const ends: number[] = [];
  return rows.map(session => {
    let lane = ends.findIndex(end => end <= minutes(session.start_time));
    if (lane < 0) lane = ends.length;
    ends[lane] = minutes(session.end_time);
    return { session, lane };
  }).map(item => ({ ...item, lanes: ends.length }));
}

/** [F008][S005] One shared appointment source powers every calendar view and detail popup. */
export default function CoachScheduleCalendarNav({ selectedDay, mode, rangeSessions, onSelectDay, onModeChange, onNavigate }: Props) {
  const [detail, setDetail] = useState<CoachSessionRow | null>(null);
  const today = formatDateKey(new Date());
  const days = mode === "day" ? [selectedDay] : weekDaysContaining(selectedDay);
  const rows = rangeSessions.filter(s => s.coach_time_confirmed).sort((a,b) => a.start_time.localeCompare(b.start_time));
  const timed = rows.filter(s => days.includes(s.session_date));
  const firstHour = Math.min(8, ...timed.map(s => Math.floor(minutes(s.start_time) / 60)));
  const lastHour = Math.max(21, ...timed.map(s => Math.ceil(minutes(s.end_time) / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const height = (lastHour - firstHour) * 72;
  const title = mode === "day" ? formatDateLabel(selectedDay) : mode === "week" ? weekTitle(selectedDay) : monthTitle(selectedDay);
  /** [F008][S005] Navigation advances exactly one visible period. */
  function navigate(delta: number) {
    onNavigate(mode === "day" ? shiftDay(selectedDay, delta) : mode === "week" ? shiftWeek(selectedDay, delta) : shiftMonth(selectedDay, delta));
  }
  /** [F008][S005] Expose full details without losing the selected calendar period. */
  function open(session: CoachSessionRow) { onSelectDay(session.session_date); setDetail(session); }
  return <div className="space-y-3" aria-label="教練排程日曆">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onNavigate(today)} className="min-h-10 rounded-lg border border-ink/20 px-3 text-sm">今天</button>
        <button type="button" aria-label="上一段" onClick={() => navigate(-1)} className="min-h-10 rounded-lg border border-ink/15 px-3">‹</button>
        <button type="button" aria-label="下一段" onClick={() => navigate(1)} className="min-h-10 rounded-lg border border-ink/15 px-3">›</button>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="flex rounded-lg border border-ink/15 bg-canvas p-1" aria-label="日曆檢視">
        {([['day','日'],['week','週'],['month','月']] as const).map(([value,label]) =>
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)} className={`min-h-10 rounded-md px-4 text-sm font-semibold ${mode === value ? 'bg-primary text-black' : 'text-ink/60'}`}>{label}</button>)}
      </div>
    </div>
    <p className="text-xs text-ink/60">只顯示教練已確認嘅逐堂排程；點課堂查看完整資料。已簽到課堂已鎖定。</p>
    {mode === "month" ? <div className="space-y-3">
      {/* [F008][S005] Seven flexible columns fit phones; the agenda exposes overflow appointments. */}
      <div aria-label="完整月曆" className="overflow-hidden rounded-xl border border-ink/15">
      <div className="w-full min-w-0">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-canvas text-center text-xs">{['一','二','三','四','五','六','日'].map(d => <div key={d} className="min-w-0 py-2"><span className="sm:hidden">{d}</span><span className="hidden sm:inline">星期{d}</span></div>)}</div>
        {monthGrid(selectedDay).map((week,i) => <div key={i} className="grid grid-cols-7">{week.map((day,j) => <div key={day ?? `blank-${j}`} className={`min-h-[100px] min-w-0 overflow-hidden border-b border-r border-ink/10 p-0.5 sm:min-h-28 sm:p-1 ${day === selectedDay ? 'bg-primary/5' : ''}`}>
          {day && <><button type="button" aria-label={formatDateLabel(day)} onClick={() => onSelectDay(day)} className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs ${day === today ? 'bg-primary font-bold' : ''}`}>{parseDateKey(day).getDate()}</button>
          <div className="sm:hidden">
            {rows.filter(s => s.session_date === day).slice(0,2).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} aria-label={`${s.start_time} ${s.student_name} ${s.course_title}`} onClick={() => open(s)} className={`mb-0.5 block w-full min-w-0 overflow-hidden rounded border px-0.5 py-0.5 text-left text-[9px] leading-tight ${calendarChipClass(s.student_id)}`}>
              <strong className="block truncate tabular-nums">{s.start_time}</strong><span className="block truncate">{s.student_name}</span>
            </button>)}
            {rows.filter(s => s.session_date === day).length > 2 ? <button type="button" aria-label={`${formatDateLabel(day)}全部課堂`} onClick={() => onSelectDay(day)} className="block w-full py-1 text-center text-[9px] font-semibold text-primary">+{rows.filter(s => s.session_date === day).length-2}</button> : null}
          </div>
          <div className="hidden sm:block">{rows.filter(s => s.session_date === day).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`mb-1 block w-full min-w-0 rounded border p-1 text-left text-[11px] ${calendarChipClass(s.student_id)}`}>
            <strong className="block">{s.start_time}–{s.end_time}</strong><span className="block break-words">{s.student_name}</span><span className="block break-words">{s.course_title}</span><span>{s.attendance_status}</span>
          </button>)}</div></>}
        </div>)}</div>)}
      </div>
      </div>
      <section aria-label="月曆當日課堂" className="space-y-2 rounded-xl border border-ink/15 bg-surface p-3 sm:hidden">
        <h3 className="text-sm font-semibold">{formatDateLabel(selectedDay)}</h3>
        {rows.filter(s => s.session_date === selectedDay).length === 0 ? <p className="py-3 text-sm text-ink/55">此日暫無已排課堂</p> : rows.filter(s => s.session_date === selectedDay).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`flex min-h-16 w-full items-start gap-3 rounded-lg border p-3 text-left ${calendarChipClass(s.student_id)}`}>
          <span className="shrink-0 text-xs font-semibold tabular-nums">{s.start_time}<br />{s.end_time}</span><span className="min-w-0"><strong className="block break-words text-sm">{s.student_name}</strong><span className="block break-words text-xs">{s.course_title}</span><span className="text-xs">{s.attendance_status}</span></span>
        </button>)}
      </section>
    </div> : <div className="max-h-[min(650px,70svh)] overflow-auto overscroll-contain rounded-xl border border-ink/15" aria-label={mode === 'day' ? '每日時間表' : '每週時間表'}>
      <div style={{ minWidth: mode === 'week' ? 900 : 0 }}>
        <div className="sticky top-0 z-20 grid border-b border-ink/15 bg-surface" style={{gridTemplateColumns:`56px repeat(${days.length}, minmax(0,1fr))`}}>
          <div aria-label="固定時間欄標題" className="sticky left-0 z-30 bg-surface p-2 text-[10px] text-ink/50">香港時間</div>{days.map(day => <button type="button" key={day} onClick={() => onSelectDay(day)} className={`border-l border-ink/10 p-2 text-xs ${day === today ? 'font-bold text-primary' : ''}`}>{parseDateKey(day).toLocaleDateString('zh-HK',{weekday:'short',month:'numeric',day:'numeric'})}</button>)}
        </div>
        <div className="grid" style={{gridTemplateColumns:`56px repeat(${days.length}, minmax(0,1fr))`}}>
          {/* [F008][S005] Sticky opaque gutter remains visible while dates scroll horizontally. */}
          <div aria-label="固定時間欄" className="sticky left-0 z-10 bg-surface text-[10px] text-ink/55" style={{height}}>{hours.slice(0,-1).map(h => <span key={h} className="absolute right-2" style={{top:(h-firstHour)*72+2}}>{String(h).padStart(2,'0')}:00</span>)}</div>
          {days.map(day => <div key={day} className="relative border-l border-ink/15" style={{height}}>
            {hours.slice(0,-1).map(h => <div key={h} className="absolute w-full border-t border-ink/10" style={{top:(h-firstHour)*72,height:72}}><div className="mt-9 border-t border-dashed border-ink/5" /></div>)}
            {eventLanes(rows.filter(s => s.session_date === day)).map(({session:s,lane,lanes}) => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`absolute overflow-auto rounded-md border px-2 py-1 text-left text-[11px] shadow-sm ${calendarChipClass(s.student_id)}`} style={{top:(minutes(s.start_time)-firstHour*60)*1.2, height:Math.max(32,(minutes(s.end_time)-minutes(s.start_time))*1.2), left:`${lane*100/lanes}%`,width:`calc(${100/lanes}% - 3px)`}}>
              <strong className="block">{s.student_name}</strong><span className="block">{s.start_time}–{s.end_time}</span><span className="block break-words">{s.course_title}</span><span className="block">{s.attendance_status}</span>
            </button>)}
          </div>)}
        </div>
      </div>
    </div>}
    {detail && <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"><div role="dialog" aria-modal="true" aria-label="課堂詳情" className="max-h-[85svh] w-full space-y-3 overflow-y-auto rounded-t-2xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-2xl">
      <h3 className="text-lg font-semibold">{detail.student_name}</h3><p>{detail.course_title}</p><p>{detail.session_date} · {detail.start_time}–{detail.end_time}</p><p>{detail.branch_name} · {detail.attendance_status}{detail.attendance_status === '已簽到' ? '（已鎖定）' : ''}</p><button type="button" onClick={() => setDetail(null)} className="min-h-11 w-full rounded-lg bg-primary px-5">關閉課堂詳情</button>
    </div></div>}
  </div>;
}
