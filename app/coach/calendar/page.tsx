"use client";

/*
 * Coach calendar — monthly grid of courses + realtime check-ins via FastAPI WebSocket `/ws/checkins`.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api, getCheckinsWebSocketUrl } from "../../../lib/api";

type CoachOpt = { id: number; full_name: string; phone: string; branch_id: number | null };
type Enr = { student_id: number; student_name: string; student_phone: string; checkin_pin: string };
type CourseRow = {
  id: number;
  title: string;
  branch_name: string;
  branch_address: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: Enr[];
};

type WsCheckinEvent = {
  event: string;
  checkin_id?: number;
  student_id?: number;
  student_name?: string;
  student_phone?: string;
  lesson_balance?: number;
  channel?: string;
  created_at?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthRangeIso(year: number, monthIdx: number): { from: string; to: string } {
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  return {
    from: `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`,
    to: `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`
  };
}

function buildCalendarCells(viewYear: number, viewMonth: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(viewYear, viewMonth, 1);
  const dow = first.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const cells: { date: Date; inMonth: boolean }[] = [];
  const cur = new Date(start);
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: new Date(cur),
      inMonth: cur.getMonth() === viewMonth
    });
    cur.setDate(cur.getDate() + 1);
  }
  return cells;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function CoachCalendarPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feed, setFeed] = useState<WsCheckinEvent[]>([]);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");
  const [filterMyStudents, setFilterMyStudents] = useState(true);

  useEffect(() => {
    api
      .coaches()
      .then((list) => {
        const arr = list as CoachOpt[];
        setCoaches(arr);
        if (arr.length) {
          setCoachId((prev) => (prev === "" ? arr[0].id : prev));
        }
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => monthRangeIso(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const loadMonth = useCallback(async () => {
    if (coachId === "") return;
    setLoading(true);
    try {
      const c = (await api.coachCourses(Number(coachId), { fromDate: rangeFrom, toDate: rangeTo })) as CourseRow[];
      setCourses(c);
      setStatus("");
    } catch (e) {
      setCourses([]);
      setStatus(String(e));
    } finally {
      setLoading(false);
    }
  }, [coachId, rangeFrom, rangeTo]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const byDay = useMemo(() => {
    const m = new Map<string, CourseRow[]>();
    for (const c of courses) {
      const k = localDateKey(c.scheduled_start);
      const list = m.get(k) ?? [];
      list.push(c);
      m.set(k, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start));
    }
    return m;
  }, [courses]);

  const myStudentIds = useMemo(() => {
    const s = new Set<number>();
    for (const c of courses) {
      for (const e of c.enrollments) {
        s.add(e.student_id);
      }
    }
    return s;
  }, [courses]);

  const myStudentIdsRef = useRef(myStudentIds);
  myStudentIdsRef.current = myStudentIds;
  const filterMyStudentsRef = useRef(filterMyStudents);
  filterMyStudentsRef.current = filterMyStudents;

  useEffect(() => {
    const url = getCheckinsWebSocketUrl();
    setWsState("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => setWsState("open");
    ws.onclose = () => setWsState("closed");
    ws.onerror = () => setWsState("closed");
    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as WsCheckinEvent;
        if (parsed.event !== "checkin_acknowledged") return;
        const sid = parsed.student_id;
        const ids = myStudentIdsRef.current;
        const filterOn = filterMyStudentsRef.current;
        const allow =
          !filterOn || ids.size === 0 || (sid != null && ids.has(sid));
        if (!allow) return;
        setFeed((prev) => [parsed, ...prev].slice(0, 40));
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, []);

  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function goToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  const title = `${viewYear} 年 ${viewMonth + 1} 月`;
  const selectedCourses = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <BackendShell title="教練日程 · 簽到直播">
      <div className="mx-auto max-w-6xl space-y-6 px-1 pb-8 md:px-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">教練日程 · 簽到直播</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              月曆顯示堂數；右側 WebSocket 即時顯示學生簽到（與{" "}
              <code className="rounded bg-[#262626] px-1 font-mono text-xs">/ws/checkins</code> 相同頻道）。可篩選「本月堂上學員」。
            </p>
            <Link href="/coach" className="mt-2 inline-block text-sm text-[#818cf8] hover:underline">
              返回單日課表（改時間）
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span className="shrink-0">教練</span>
              <select
                className="!w-auto min-w-[10rem] max-w-[min(100%,16rem)] rounded-lg border border-white/15 bg-neutral-900 px-2 py-1.5 text-sm text-zinc-100 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/40 [&>option]:bg-neutral-900 [&>option]:text-zinc-100"
                value={coachId === "" ? "" : String(coachId)}
                onChange={(ev) => setCoachId(ev.target.value ? Number(ev.target.value) : "")}
              >
                <option value="">—</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-neutral-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-600 disabled:opacity-50"
              onClick={() => void loadMonth()}
              disabled={loading}
            >
              {loading ? "更新中…" : "重新載入"}
            </button>
          </div>
        </div>

        {status && <p className="text-sm text-amber-300">{status}</p>}

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-[#171717] px-4 py-3">
              <button
                type="button"
                className="min-w-[2.25rem] rounded-lg border border-white/15 bg-neutral-800 px-2 py-1.5 text-lg font-medium leading-none text-zinc-100 shadow-sm hover:bg-neutral-700"
                onClick={() => shiftMonth(-1)}
                aria-label="上個月"
              >
                ‹
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-base font-semibold text-white">{title}</span>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-md border border-indigo-400/50 bg-indigo-600/30 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-600/45"
                >
                  今天
                </button>
              </div>
              <button
                type="button"
                className="min-w-[2.25rem] rounded-lg border border-white/15 bg-neutral-800 px-2 py-1.5 text-lg font-medium leading-none text-zinc-100 shadow-sm hover:bg-neutral-700"
                onClick={() => shiftMonth(1)}
                aria-label="下個月"
              >
                ›
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414]">
              <div className="grid grid-cols-7 border-b border-white/[0.08] bg-[#1a1a1a] text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-2">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-[#2a2a2a]">
                {cells.map((cell, idx) => {
                  const key = `${cell.date.getFullYear()}-${pad2(cell.date.getMonth() + 1)}-${pad2(cell.date.getDate())}`;
                  const dayCourses = byDay.get(key) ?? [];
                  const isSel = selectedKey === key;
                  const isToday =
                    cell.date.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`min-h-[92px] bg-[#141414] p-1.5 text-left transition hover:bg-[#1f1f1f] md:min-h-[104px] ${
                        !cell.inMonth ? "opacity-40" : ""
                      } ${isSel ? "ring-1 ring-inset ring-[#6366f1]/70" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[13px] font-medium ${isToday ? "text-[#a5b4fc]" : cell.inMonth ? "text-white" : "text-slate-500"}`}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayCourses.length > 0 && (
                          <span className="rounded-full bg-[#6366f1]/25 px-1.5 py-px text-[10px] text-indigo-200">
                            {dayCourses.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dayCourses.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            className="truncate rounded bg-white/[0.06] px-1 py-px text-[10px] leading-tight text-slate-300"
                            title={c.title}
                          >
                            {new Date(c.scheduled_start).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}{" "}
                            {c.title}
                          </div>
                        ))}
                        {dayCourses.length > 3 && (
                          <p className="text-[10px] text-slate-500">+{dayCourses.length - 3}…</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedKey && (
              <div className="rounded-xl border border-white/[0.1] bg-[#171717] p-4">
                <h3 className="text-sm font-semibold text-white">
                  {selectedKey} 的課堂
                </h3>
                <ul className="mt-3 space-y-3">
                  {selectedCourses.length === 0 ? (
                    <li className="text-sm text-slate-500">當日無堂。</li>
                  ) : (
                    selectedCourses.map((c) => (
                      <li key={c.id} className="rounded-lg border border-white/[0.06] bg-[#1c1c1c] p-3 text-sm">
                        <p className="font-medium text-white">{c.title}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(c.scheduled_start).toLocaleString()} —{" "}
                          {new Date(c.scheduled_end).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {c.branch_name}
                        </p>
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                          {c.enrollments.map((e) => (
                            <li key={e.student_id}>
                              {e.student_name} · PIN{" "}
                              <span className="font-mono text-indigo-200">{e.checkin_pin}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-white/[0.1] bg-[#171717] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">簽到直播</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    wsState === "open"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : wsState === "connecting"
                        ? "bg-amber-500/15 text-amber-200"
                        : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {wsState === "open" ? "Live" : wsState === "connecting" ? "連線中" : "已斷線"}
                </span>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  className="rounded border-white/20 bg-[#2a2a2a]"
                  checked={filterMyStudents}
                  onChange={(e) => setFilterMyStudents(e.target.checked)}
                />
                只顯示「本月堂上」學員簽到
              </label>
            </div>
            <div className="max-h-[min(520px,70vh)] space-y-2 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0f0f0f] p-3">
              {feed.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  等候學生於學生簽到頁扣堂…
                </p>
              ) : (
                feed.map((ev, i) => (
                  <div
                    key={`${ev.checkin_id ?? i}-${ev.created_at ?? ""}`}
                    className="rounded-lg border border-white/[0.06] bg-[#1a1a1a] p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-white">{ev.student_name ?? "—"}</span>
                      <span className="shrink-0 text-xs text-emerald-400">
                        餘 {ev.lesson_balance ?? "—"} 堂
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {ev.created_at
                        ? new Date(ev.created_at).toLocaleString()
                        : ""}{" "}
                      · {ev.channel ?? "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </BackendShell>
  );
}
