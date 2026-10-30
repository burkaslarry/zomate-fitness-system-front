"use client";

/** [F008][S005] Google Calendar-style day/week time grid and full month appointments. */
import { useEffect, useRef, useState } from "react";
import { formatDateKey, formatDateLabel, monthGrid, monthTitle, parseDateKey, shiftDay, shiftMonth, shiftWeek, weekDaysContaining, weekTitle } from "../lib/coach-schedule-dates";
import { type CoachSessionRow } from "../lib/coach-sessions";

export type CalendarMode = "day" | "three-day" | "week" | "month" | "agenda";
type Props = {
  selectedDay: string; mode: CalendarMode; rangeSessions: CoachSessionRow[];
  onSelectDay: (day: string) => void; onModeChange: (mode: CalendarMode) => void;
  onNavigate: (day: string) => void;
  /** [F008][S007] Admin multi-coach view labels every block with its coach. */
  showCoach?: boolean;
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

/** [F008][S005] Stable solid appointment colours; 新學生試堂 is always red. */
function eventClass(studentId: number, attendanceStatus?: string): string {
  if (attendanceStatus === "試堂") return "bg-red-600 border-red-600 text-white";
  return ["bg-blue-700 border-blue-700 text-white", "bg-emerald-700 border-emerald-700 text-white", "bg-violet-700 border-violet-700 text-white", "bg-amber-700 border-amber-700 text-white", "bg-rose-700 border-rose-700 text-white", "bg-cyan-800 border-cyan-800 text-white"][Math.abs(studentId) % 6];
}

/** [F008][S005] One shared appointment source powers every calendar view and detail popup. */
export default function CoachScheduleCalendarNav({ selectedDay, mode, rangeSessions, onSelectDay, onModeChange, onNavigate, showCoach = false }: Props) {
  const [detail, setDetail] = useState<CoachSessionRow | null>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const today = formatDateKey(new Date());
  const days = mode === "day" ? [selectedDay] : mode === "three-day" ? [selectedDay, shiftDay(selectedDay, 1), shiftDay(selectedDay, 2)] : weekDaysContaining(selectedDay);
  const rows = rangeSessions.filter(s => s.coach_time_confirmed).sort((a,b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time));
  const timed = rows.filter(s => days.includes(s.session_date));
  const firstHour = Math.min(8, ...timed.map(s => Math.floor(minutes(s.start_time) / 60)));
  const lastHour = Math.max(21, ...timed.map(s => Math.ceil(minutes(s.end_time) / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const height = (lastHour - firstHour) * 72;
  const firstAppointment = timed.length ? Math.min(...timed.map(s => minutes(s.start_time))) : firstHour * 60;
  // [F008][S005] Open on today's current time (one hour of context), else near the first lesson.
  useEffect(() => {
    if (!timeGridRef.current) return;
    const showsToday = mode === "day"
      ? selectedDay === today
      : mode === "three-day"
        ? [selectedDay, shiftDay(selectedDay, 1), shiftDay(selectedDay, 2)].includes(today)
        : weekDaysContaining(selectedDay).includes(today);
    const now = new Date();
    const anchor = showsToday ? now.getHours() * 60 + now.getMinutes() : firstAppointment;
    timeGridRef.current.scrollTop = Math.max(0, (anchor - firstHour * 60 - 60) * 1.2);
  }, [mode, selectedDay, firstAppointment, firstHour, today]);
  const title = mode === "day" ? formatDateLabel(selectedDay) : mode === "three-day" ? `${parseDateKey(selectedDay).toLocaleDateString('zh-HK',{month:'numeric',day:'numeric'})} – ${parseDateKey(shiftDay(selectedDay, 2)).toLocaleDateString('zh-HK',{month:'numeric',day:'numeric'})}` : mode === "week" ? weekTitle(selectedDay) : monthTitle(selectedDay);
  /** [F008][S005] Navigation advances exactly one visible period. */
  function navigate(delta: number) {
    onNavigate(mode === "day" ? shiftDay(selectedDay, delta) : mode === "three-day" ? shiftDay(selectedDay, delta * 3) : mode === "week" ? shiftWeek(selectedDay, delta) : shiftMonth(`${selectedDay.slice(0, 7)}-01`, delta));
  }
  /** [F008][S005] Expose full details without losing the selected calendar period. */
  function open(session: CoachSessionRow) { onSelectDay(session.session_date); setDetail(session); }
  return <div className="space-y-3 bg-white sm:bg-surface" aria-label="教練排程日曆">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto">
        <button type="button" onClick={() => onNavigate(today)} className="min-h-10 rounded-lg border border-ink/20 px-3 text-sm">今天</button>
        <button type="button" aria-label="上一段" onClick={() => navigate(-1)} className="min-h-10 rounded-lg border border-ink/15 px-3">‹</button>
        <button type="button" aria-label="下一段" onClick={() => navigate(1)} className="min-h-10 rounded-lg border border-ink/15 px-3">›</button>
        <button type="button" aria-label="展開迷你月曆" aria-expanded={monthOpen} onClick={() => setMonthOpen(!monthOpen)} className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none text-left text-sm font-semibold">{title} <span aria-hidden="true">{monthOpen ? "▴" : "▾"}</span></button>
      </div>
      <div className="flex w-full rounded-xl border border-ink/15 bg-canvas p-1 sm:w-auto" aria-label="日曆檢視">
        {([['agenda','行程'],['day','日'],['three-day','3 日'],['week','週'],['month','月']] as const).map(([value,label]) =>
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${mode === value ? 'bg-primary text-black' : 'border-transparent bg-transparent text-ink/60 shadow-none'}`}>{label}</button>)}
      </div>
    </div>
    {/* [F008][S005] Expandable month picker shares the loaded appointment range; no synthetic events. */}
    {monthOpen && <div aria-label="迷你月曆" className="rounded-xl border border-ink/10 p-2">
      <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="迷你月曆上個月" className="h-11 w-11" onClick={() => onNavigate(shiftMonth(`${selectedDay.slice(0,7)}-01`, -1))}>‹</button><p className="text-sm font-semibold">{monthTitle(selectedDay)}</p><button type="button" aria-label="迷你月曆下個月" className="h-11 w-11" onClick={() => onNavigate(shiftMonth(`${selectedDay.slice(0,7)}-01`, 1))}>›</button></div>
      <div className="grid grid-cols-7 text-center text-xs text-ink/55">{['一','二','三','四','五','六','日'].map(d => <span key={d}>{d}</span>)}</div>
      {monthGrid(selectedDay).map((week,i) => <div key={i} className="grid grid-cols-7">{week.map((day,j) => day ? <button key={day} type="button" aria-label={formatDateLabel(day)} aria-pressed={day === selectedDay} onClick={() => onSelectDay(day)} className="flex min-h-11 flex-col items-center justify-center gap-1 border-0 bg-transparent p-0 shadow-none">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${day === selectedDay ? 'bg-primary font-bold text-black' : day === today ? 'bg-primary/20' : ''}`}>{parseDateKey(day).getDate()}</span>
        <span className="flex h-1 gap-0.5" aria-hidden="true">{rows.filter(s => s.session_date === day).slice(0,3).map(s => <span key={s.enrollment_id} className={`h-1 w-1 rounded-full border ${eventClass(s.student_id, s.attendance_status)}`} />)}</span>
      </button> : <span key={`blank-${j}`} />)}</div>)}
    </div>}
    <p className="text-xs text-ink/60">只顯示教練已確認嘅逐堂排程；點課堂查看完整資料。已簽到課堂已鎖定。</p>
    {mode === "agenda" ? <section aria-label="行程清單" className="space-y-5 py-2">
      {/* [F008][S005] Chronological month agenda retains full names and every appointment. */}
      {rows.filter(s => s.session_date.startsWith(selectedDay.slice(0,7))).length === 0 && <p className="py-8 text-center text-sm text-ink/55">本月暫無已排課堂</p>}
      {Array.from(new Set(rows.filter(s => s.session_date.startsWith(selectedDay.slice(0,7))).map(s => s.session_date))).map(day => <section key={day} aria-label={formatDateLabel(day)} className="flex items-start gap-3">
        <button type="button" onClick={() => { onSelectDay(day); onModeChange('day'); }} className="sticky top-0 flex w-12 shrink-0 flex-col items-center gap-1 border-0 bg-transparent p-0 text-xs shadow-none"><span>{parseDateKey(day).toLocaleDateString('zh-HK',{weekday:'short'})}</span><strong className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${day === today ? 'bg-primary text-black' : ''}`}>{parseDateKey(day).getDate()}</strong></button>
        <div className="min-w-0 flex-1 space-y-2">{rows.filter(s => s.session_date === day).map(s => <button type="button" key={s.enrollment_id} onClick={() => open(s)} className={`block min-h-20 w-full rounded-xl border p-3 text-left ${eventClass(s.student_id, s.attendance_status)}`}><strong className="block break-words text-base">{s.student_name}</strong>{showCoach && s.coach_name ? <span className="block break-words text-xs opacity-90">{s.coach_name}</span> : null}<span className="block text-sm tabular-nums">{s.start_time}–{s.end_time}</span><span className="block break-words text-xs">{s.course_title} · {s.branch_name}</span><span className="text-xs">{s.attendance_status}</span></button>)}</div>
      </section>)}
    </section> : mode === "month" ? <div className="space-y-3">
      {/* [F008][S005] Seven flexible columns fit phones; the agenda exposes overflow appointments. */}
      <div aria-label="完整月曆" className="overflow-hidden rounded-xl border border-ink/15">
      <div className="w-full min-w-0">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-canvas text-center text-xs">{['一','二','三','四','五','六','日'].map(d => <div key={d} className="min-w-0 py-2"><span className="sm:hidden">{d}</span><span className="hidden sm:inline">星期{d}</span></div>)}</div>
        {monthGrid(selectedDay).map((week,i) => <div key={i} className="grid grid-cols-7">{week.map((day,j) => <div key={day ?? `blank-${j}`} className={`min-h-[105px] min-w-0 overflow-hidden border-b border-r border-ink/10 p-0.5 sm:min-h-28 sm:p-1 ${day === selectedDay ? 'bg-primary/5' : ''}`}>
          {day && <><button type="button" aria-label={formatDateLabel(day)} onClick={() => onSelectDay(day)} className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full border-0 p-0 text-xs shadow-none ${day === today ? 'bg-primary font-bold' : ''}`}>{parseDateKey(day).getDate()}</button>
          <div className="sm:hidden">
            {rows.filter(s => s.session_date === day).slice(0,3).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} aria-label={`${s.start_time} ${s.student_name} ${s.course_title}`} onClick={() => open(s)} className={`mb-0.5 block w-full min-w-0 overflow-hidden rounded border px-0.5 py-0.5 text-left text-[9px] leading-tight ${eventClass(s.student_id, s.attendance_status)}`}>
              <span className="block truncate font-semibold">{s.start_time} {s.student_name}</span>
            </button>)}
            {rows.filter(s => s.session_date === day).length > 3 ? <button type="button" aria-label={`${formatDateLabel(day)}全部課堂`} onClick={() => onSelectDay(day)} className="block w-full py-1 text-center text-[9px] font-semibold text-primary">+{rows.filter(s => s.session_date === day).length-3}</button> : null}
          </div>
          <div className="hidden sm:block">{rows.filter(s => s.session_date === day).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`mb-1 block w-full min-w-0 rounded border p-1 text-left text-[11px] ${eventClass(s.student_id, s.attendance_status)}`}>
            <strong className="block">{s.start_time}–{s.end_time}</strong><span className="block break-words">{s.student_name}</span><span className="block break-words">{s.course_title}</span><span>{s.attendance_status}</span>
          </button>)}</div></>}
        </div>)}</div>)}
      </div>
      </div>
      <section aria-label="月曆當日課堂" className="space-y-2 rounded-xl border border-ink/15 bg-surface p-3 sm:hidden">
        <h3 className="text-sm font-semibold">{formatDateLabel(selectedDay)}</h3>
        {rows.filter(s => s.session_date === selectedDay).length === 0 ? <p className="py-3 text-sm text-ink/55">此日暫無已排課堂</p> : rows.filter(s => s.session_date === selectedDay).map(s => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`flex min-h-16 w-full items-start gap-3 rounded-lg border p-3 text-left ${eventClass(s.student_id, s.attendance_status)}`}>
          <span className="shrink-0 text-xs font-semibold tabular-nums">{s.start_time}<br />{s.end_time}</span><span className="min-w-0"><strong className="block break-words text-sm">{s.student_name}</strong>{showCoach && s.coach_name ? <span className="block break-words text-xs opacity-90">{s.coach_name}</span> : null}<span className="block break-words text-xs">{s.course_title}</span><span className="text-xs">{s.attendance_status}</span></span>
        </button>)}
      </section>
    </div> : <div ref={timeGridRef} className="max-h-[min(650px,70svh)] overflow-auto overscroll-contain rounded-xl border border-ink/15" aria-label={mode === 'day' ? '每日時間表' : mode === 'three-day' ? '三日時間表' : '每週時間表'}>
      <div style={{ minWidth: mode === 'week' ? 900 : 0 }}>
        <div className="sticky top-0 z-20 grid border-b border-ink/15 bg-white sm:bg-surface" style={{gridTemplateColumns:`56px repeat(${days.length}, minmax(0,1fr))`}}>
          <div aria-label="固定時間欄標題" className="sticky left-0 z-30 bg-white p-2 sm:bg-surface text-[10px] text-ink/50">香港時間</div>{days.map(day => <button type="button" key={day} onClick={() => onSelectDay(day)} className={`rounded-none border-0 border-l border-ink/10 bg-transparent px-1 py-2 text-xs shadow-none ${day === today ? 'font-bold text-primary' : ''}`}><span className="block">{parseDateKey(day).toLocaleDateString('zh-HK',{weekday:'short'})}</span><strong className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg ${day === today ? 'bg-primary text-black' : ''}`}>{parseDateKey(day).getDate()}</strong></button>)}
        </div>
        <div className="grid" style={{gridTemplateColumns:`56px repeat(${days.length}, minmax(0,1fr))`}}>
          {/* [F008][S005] Sticky opaque gutter remains visible while dates scroll horizontally. */}
          <div aria-label="固定時間欄" className="sticky left-0 z-10 bg-white text-[10px] text-ink/55" style={{height}}>{hours.slice(0,-1).map(h => <span key={h} className="absolute right-2" style={{top:(h-firstHour)*72+2}}>{String(h).padStart(2,'0')}:00</span>)}</div>
          {days.map(day => <div key={day} className="relative border-l border-ink/15" style={{height}}>
            {hours.slice(0,-1).map(h => <div key={h} className="absolute w-full border-t border-ink/10" style={{top:(h-firstHour)*72,height:72}}><div className="mt-9 border-t border-dashed border-ink/5" /></div>)}
            {eventLanes(rows.filter(s => s.session_date === day)).map(({session:s,lane,lanes}) => <button type="button" key={`${s.enrollment_id}-${s.session_date}`} onClick={() => open(s)} className={`absolute overflow-auto rounded-lg border px-1 py-1 text-left text-[11px] sm:px-2 shadow-sm ${eventClass(s.student_id, s.attendance_status)}`} style={{top:(minutes(s.start_time)-firstHour*60)*1.2, height:Math.max(32,(minutes(s.end_time)-minutes(s.start_time))*1.2), left:`${lane*100/lanes}%`,width:`calc(${100/lanes}% - 3px)`}}>
              <strong className="block">{s.student_name}</strong>{showCoach && s.coach_name ? <span className="block opacity-90">{s.coach_name}</span> : null}<span className="block">{s.start_time}–{s.end_time}</span><span className="block break-words">{s.course_title}</span><span className="block">{s.attendance_status}</span>
            </button>)}
          </div>)}
        </div>
      </div>
    </div>}
    {detail && <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"><div role="dialog" aria-modal="true" aria-label="課堂詳情" className="max-h-[85svh] w-full space-y-3 overflow-y-auto rounded-t-2xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-2xl">
      <h3 className="text-lg font-semibold">{detail.student_name}</h3>{showCoach && detail.coach_name ? <p className="text-sm text-ink/70">教練：{detail.coach_name}</p> : null}<p>{detail.course_title}</p><p>{detail.session_date} · {detail.start_time}–{detail.end_time}</p><p>{detail.branch_name} · {detail.attendance_status}{detail.attendance_status === '已簽到' ? '（已鎖定）' : ''}</p><button type="button" onClick={() => setDetail(null)} className="min-h-11 w-full rounded-lg bg-primary px-5">關閉課堂詳情</button>
    </div></div>}
  </div>;
}
