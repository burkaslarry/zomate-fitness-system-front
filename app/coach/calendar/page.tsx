"use client";

/**
 * [F003][S002]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: Coach calendar + live feed + bottom-tab PIN／流程參考
 * Logic: Month grid; WS check-ins; third coach tab links student check-in, admin PIN paths, trial PIN.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { usePathname } from "next/navigation";
import BackendShell from "../../../components/backend-shell";
import CoachCategoryFilter from "../../../components/coach-category-filter";
import { alertApiError, api, getCheckinsWebSocketUrl } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import {
  type CoachSessionRow,
  groupSessionsByDate,
  sessionIsCheckedIn,
  sessionRedeemedDayKey,
  sessionRedeemedPairKey
} from "../../../lib/coach-sessions";

type CoachOpt = { id: number; full_name: string; phone: string; branch_id: number | null };

type WsCheckinEvent = {
  event: string;
  checkin_id?: number;
  student_id?: number;
  student_name?: string;
  student_phone?: string;
  lesson_balance?: number;
  channel?: string;
  created_at?: string;
  course_id?: number | null;
  session_calendar_date?: string | null;
  course_title?: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
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

/** [F003][S003] Master admin／教練：簽到與課堂 PIN 途徑一覽。 */
function PinFlowGuide() {
  const rows: { who: string; path: string; href: string }[] = [
    { who: "學生／店內簽到", path: "搜尋 → 揀今日堂 → 課堂 PIN 扣堂", href: "/student/checkin" },
    {
      who: "職員 · 該學員所有課堂 PIN",
      path: "Admin → 學生名單 → 點姓名 → 課程記錄 → 已開課程",
      href: "/admin/students"
    },
    { who: "職員 · 報 Course", path: "報 Course / 收費 → 開課頁產生 PIN", href: "/regCourse" }
  ];
  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
      <h2 className="text-sm font-semibold text-ink">簽到與課堂 PIN · 快速途徑</h2>
      <p className="mt-2 text-xs leading-relaxed text-ink/55">
        開課時後台會按<strong>上課星期</strong>同首課時間<strong>自動排一系列堂</strong>；如遇唔得閒，教練請喺{" "}
        <Link href="/coach" className="font-medium text-primary underline-offset-2 hover:underline">
          教練上堂
        </Link>{" "}
        改該系列的具體日期時間。
      </p>
      <ul className="mt-3 space-y-2 text-xs">
        {rows.map((r) => (
          <li
            key={r.href + r.who}
            className="rounded-lg border border-ink/[0.06] bg-canvas/80 px-2.5 py-2 leading-snug"
          >
            <div className="font-medium text-ink">{r.who}</div>
            <div className="mt-0.5 text-ink/65">{r.path}</div>
            <Link href={r.href} className="mt-1 inline-block font-medium text-primary underline-offset-2 hover:underline">
              開啟 → {r.href}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CoachCalendarPage() {
  const pathname = usePathname();
  const inPortalLayout = pathname.startsWith("/coach-portal");
  /** 須待 client mount 先讀 session；首屏勿用 ``false`` 誤打 ``api.coaches()``（COACH 會 403）。 */
  const [portalResolved, setPortalResolved] = useState(false);
  const [coachPortal, setCoachPortal] = useState(false);
  /** COACH mobile：底欄（日程 | 簽到實時 | PIN／途徑） */
  const [mobileCoachTab, setMobileCoachTab] = useState<"calendar" | "live" | "guide">("calendar");
  const touchStartX = useRef<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [redeemedPairs, setRedeemedPairs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const role = getAuthSession()?.role;
    setCoachPortal(inPortalLayout || role === "COACH");
    setPortalResolved(true);
  }, [inPortalLayout]);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [sessions, setSessions] = useState<CoachSessionRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feed, setFeed] = useState<WsCheckinEvent[]>([]);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">("connecting");
  const [filterMyStudents, setFilterMyStudents] = useState(true);
  const [portalCoachNote, setPortalCoachNote] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!portalResolved) return;
    const loader = coachPortal ? api.publicCoaches : api.coaches;
    void loader()
      .then((list) => {
        const arr = list as CoachOpt[];
        setCoaches(arr);
        if (!coachPortal && arr.length) {
          setCoachId((prev) => (prev === "" ? arr[0].id : prev));
        }
      })
      .catch((e) => setStatus(String(e)));
  }, [portalResolved, coachPortal]);

  useEffect(() => {
    if (!portalResolved) return;
    if (!coachPortal || coaches.length === 0) {
      setPortalCoachNote("");
      return;
    }
    const uname = (getAuthSession()?.username ?? "").trim().toLowerCase();
    const byName =
      coaches.find((c) => {
        const fn = c.full_name.trim().toLowerCase();
        if (!uname) return false;
        if (fn === uname) return true;
        if (fn.replace(/\s+/g, "") === uname.replace(/\s+/g, "")) return true;
        return fn.split(/\s+/).some((p) => p === uname || uname.includes(p));
      }) ?? null;
    if (byName) {
      setCoachId(byName.id);
      setPortalCoachNote("");
      return;
    }
    if (coaches.length === 1) {
      setCoachId(coaches[0].id);
      setPortalCoachNote("");
      return;
    }
    setPortalCoachNote("未能自動對應教練，請聯絡 admin 將登入帳號與「教練」名稱對齊。");
  }, [portalResolved, coachPortal, coaches]);

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => monthRangeIso(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const loadMonth = useCallback(async () => {
    if (!portalResolved || coachId === "") return;
    setLoading(true);
    try {
      const rows = (await api.coachSessions(Number(coachId), {
        fromDate: rangeFrom,
        toDate: rangeTo,
        categoryIds: categoryIds.length ? categoryIds : undefined
      })) as CoachSessionRow[];
      setSessions(rows ?? []);
      setStatus("");
    } catch (e) {
      setSessions([]);
      setStatus(String(e));
    } finally {
      setLoading(false);
    }
  }, [portalResolved, coachId, rangeFrom, rangeTo, categoryIds]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  /** 換月／換 coach 視圖後清空「已簽到」標記，避免套用舊班別。 */
  useEffect(() => {
    setRedeemedPairs(new Set());
  }, [coachId, viewYear, viewMonth]);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3800);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const byDay = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const myStudentIds = useMemo(() => {
    const s = new Set<number>();
    for (const row of sessions) {
      s.add(row.student_id);
    }
    return s;
  }, [sessions]);

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
        const name = parsed.student_name?.trim() || "學員";
        const ttl = parsed.course_title?.trim();
        const line = ttl ? `${name} 已於「${ttl}」簽到扣堂` : `${name} 已簽到扣堂`;
        setToastMsg(line);
        const cid = parsed.course_id;
        const calDate = parsed.session_calendar_date?.trim() || null;
        if (typeof cid === "number" && sid != null) {
          setRedeemedPairs((prev) => {
            const next = new Set(prev);
            next.add(sessionRedeemedPairKey(cid, sid));
            if (calDate) next.add(sessionRedeemedDayKey(cid, sid, calDate));
            return next;
          });
        }
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
  const selectedSessions = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  const selectedCoachLabel = coaches.find((c) => c.id === coachId)?.full_name ?? "—";

  const sessionLooksRedeemed = useCallback(
    (s: CoachSessionRow) => sessionIsCheckedIn(s, redeemedPairs),
    [redeemedPairs]
  );

  const liveAside = (
    <aside className={`space-y-3 ${coachPortal ? "" : "lg:sticky lg:top-24 lg:self-start"}`}>
      <div className="rounded-xl border border-ink/10 bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">簽到直播</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
              wsState === "open"
                ? "bg-emerald-500/20 text-emerald-800"
                : wsState === "connecting"
                  ? "bg-amber-500/15 text-amber-900"
                  : "bg-rose-500/15 text-rose-800"
            }`}
          >
            {wsState === "open" ? "Live" : wsState === "connecting" ? "連線中" : "已斷線"}
          </span>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink/55">
          <input
            type="checkbox"
            className="rounded border-ink/15 bg-canvas"
            checked={filterMyStudents}
            onChange={(e) => setFilterMyStudents(e.target.checked)}
          />
          只顯示「本月堂上」學員簽到
        </label>
      </div>
      <div
        className={`space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-canvas p-3 shadow-sm ring-1 ring-ink/[0.04] ${coachPortal ? "min-h-[52vh] max-h-[min(78vh,620px)]" : "max-h-[min(520px,70vh)] sm:max-h-[min(560px,72vh)]"}`}
      >
        {feed.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink/50">等候學生於學生簽到頁扣堂…</p>
        ) : (
          feed.map((ev, i) => (
            <div
              key={`${ev.checkin_id ?? i}-${ev.created_at ?? ""}`}
              className="rounded-lg border border-ink/[0.08] bg-surface p-3 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-ink">{ev.student_name ?? "—"}</span>
                <span className="shrink-0 text-xs font-medium text-emerald-700">餘 {ev.lesson_balance ?? "—"} 堂</span>
              </div>
              <p className="mt-1 text-[11px] text-ink/50">
                {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""} · {ev.channel ?? "—"}
              </p>
              {ev.course_title ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-800/90">課堂：{ev.course_title}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );

  const coachTouchStart = (e: ReactTouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const coachTouchEnd = (e: ReactTouchEvent) => {
    if (!coachPortal) return;
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (dx < -56) {
      setMobileCoachTab((t) => (t === "calendar" ? "live" : t === "live" ? "guide" : "guide"));
    } else if (dx > 56) {
      setMobileCoachTab((t) => (t === "guide" ? "live" : t === "live" ? "calendar" : "calendar"));
    }
  };

  async function exportMonth() {
    if (coachId === "") return;
    setExporting(true);
    try {
      await api.downloadCoachSessionsExport(
        Number(coachId),
        {
          fromDate: rangeFrom,
          toDate: rangeTo,
          categoryIds: categoryIds.length ? categoryIds : undefined
        },
        `coach-sessions-${rangeFrom}_${rangeTo}.csv`
      );
    } catch (e) {
      alertApiError(e);
    } finally {
      setExporting(false);
    }
  }

  const shellTitle = coachPortal ? "學生上堂" : "學生上堂";

  const pageBody = (
    <>
        {toastMsg ? (
          <div
            className="pointer-events-none fixed left-3 right-3 top-[4.75rem] z-[120] mx-auto max-w-lg md:left-auto md:right-8 md:mx-0 md:max-w-md"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-lg ring-1 ring-emerald-500/25">
              {toastMsg}
            </div>
          </div>
        ) : null}
      <div
        className={`touch-pan-y space-y-4 ${coachPortal ? "pb-[5.25rem]" : "pb-0"} ${coachPortal ? "mx-auto max-w-lg px-0" : "mx-auto max-w-6xl space-y-4 px-0 sm:space-y-6 md:px-0"}`}
        onTouchStart={coachPortal ? coachTouchStart : undefined}
        onTouchEnd={coachPortal ? coachTouchEnd : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {!coachPortal ? (
              <h1 className="text-xl font-bold tracking-tight text-ink">學生上堂</h1>
            ) : null}
            {!coachPortal ? (
              <>
                <p className="mt-1 max-w-xl text-sm text-ink/55">
                  月曆顯示堂數；右側 WebSocket 即時顯示學生簽到。可篩選課程類型並匯出 Excel。
                </p>
                <Link href="/coach" className="mt-2 inline-block text-sm text-primary hover:text-ink hover:underline">
                  返回教練上堂（單日）
                </Link>
                <div className="mt-4 hidden md:block">
                  <PinFlowGuide />
                </div>
              </>
            ) : (
              <p className="text-xs text-ink/55">
                底部選單三格：<strong className="text-ink/80">日程 · 簽到 · PIN／途徑</strong>
                ；可左右掃屏切換。簽到會 toast · 課堂格顯示已扣堂青色。
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {coachPortal ? (
              <p className="text-sm font-medium text-ink">
                教練：<span className="text-ink/75">{selectedCoachLabel}</span>
              </p>
            ) : (
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
                <span className="shrink-0">教練</span>
                <select
                  className="!w-auto min-w-[10rem] max-w-[min(100%,16rem)] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm text-ink shadow-sm outline-none focus:ring-2 focus:ring-primary/35 [&>option]:bg-surface [&>option]:text-ink"
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
            )}
            <button
              type="button"
              className="rounded-lg border border-ink/15 bg-primary/90 px-3 py-1.5 text-sm font-medium text-black shadow-sm hover:bg-primary disabled:opacity-50"
              onClick={() => void loadMonth()}
              disabled={loading}
            >
              {loading ? "更新中…" : "重新載入"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
              onClick={() => void exportMonth()}
              disabled={exporting || coachId === ""}
            >
              {exporting ? "匯出中…" : "匯出 Excel"}
            </button>
          </div>
        </div>

        {coachId !== "" ? (
          <CoachCategoryFilter coachId={coachId} selectedIds={categoryIds} onChange={setCategoryIds} />
        ) : null}

        {portalCoachNote && coachPortal ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">{portalCoachNote}</p>
        ) : null}

        {status && <p className="text-sm text-amber-900">{status}</p>}

        <div className={coachPortal ? "" : "grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]"}>
          <div
            className={`space-y-3 ${coachPortal && mobileCoachTab !== "calendar" ? "hidden" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface px-4 py-3">
              <button
                type="button"
                className="min-w-[2.25rem] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-lg font-medium leading-none text-ink shadow-sm hover:bg-surface"
                onClick={() => shiftMonth(-1)}
                aria-label="上個月"
              >
                ‹
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-base font-semibold text-ink">{title}</span>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-md border border-primary/35 bg-primary/15 px-2.5 py-1 text-xs font-medium text-black shadow-sm hover:bg-primary/25"
                >
                  今天
                </button>
              </div>
              <button
                type="button"
                className="min-w-[2.25rem] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-lg font-medium leading-none text-ink shadow-sm hover:bg-surface"
                onClick={() => shiftMonth(1)}
                aria-label="下個月"
              >
                ›
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
              <div className="grid grid-cols-7 border-b border-ink/[0.08] bg-canvas text-center text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-2">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-ink/10">
                {cells.map((cell, idx) => {
                  const key = `${cell.date.getFullYear()}-${pad2(cell.date.getMonth() + 1)}-${pad2(cell.date.getDate())}`;
                  const daySessions = byDay.get(key) ?? [];
                  const dayHasRedeemedLesson = daySessions.some((s) => sessionLooksRedeemed(s));
                  const isSel = selectedKey === key;
                  const isToday =
                    cell.date.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`min-h-[88px] shadow-sm ring-1 ring-ink/[0.04] p-1.5 text-left transition hover:bg-canvas sm:min-h-[92px] md:min-h-[104px] ${
                        dayHasRedeemedLesson ?
                          cell.inMonth ?
                            "bg-emerald-50/95 ring-emerald-300/55"
                          : "bg-emerald-50/50 opacity-[0.45]"
                        : "bg-surface"
                      } ${!cell.inMonth && !dayHasRedeemedLesson ? "opacity-40" : ""} ${isSel ? "ring-2 ring-inset ring-primary/60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[13px] font-medium ${isToday ? "text-primary" : cell.inMonth ? "text-ink" : "text-ink/50"}`}
                        >
                          {cell.date.getDate()}
                        </span>
                        {daySessions.length > 0 && (
                          <span className="rounded-full bg-primary/25 px-1.5 py-px text-[10px] text-black">
                            {daySessions.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {daySessions.slice(0, 3).map((s) => (
                          <div
                            key={`${s.enrollment_id}-${s.session_date}-${s.student_id}`}
                            className={`truncate rounded px-1 py-px text-[10px] leading-tight ${
                              sessionLooksRedeemed(s)
                                ? "border border-emerald-400/65 bg-emerald-100/90 font-semibold text-emerald-950"
                                : "border border-ink/[0.06] bg-canvas text-ink/70"
                            }`}
                            title={`${s.student_name} · ${s.category_name}`}
                          >
                            {s.start_time} {s.student_name}
                          </div>
                        ))}
                        {daySessions.length > 3 && (
                          <p className="text-[10px] text-ink/50">+{daySessions.length - 3}…</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedKey && (
              <div className="rounded-xl border border-ink/10 bg-surface p-4">
                <h3 className="text-sm font-semibold text-ink">
                  {selectedKey} 的課堂
                </h3>
                <ul className="mt-3 space-y-3">
                  {selectedSessions.length === 0 ? (
                    <li className="text-sm text-ink/50">當日無堂。</li>
                  ) : (
                    selectedSessions.map((s) => {
                      const checkedIn = sessionLooksRedeemed(s);
                      return (
                        <li
                          key={`${s.enrollment_id}-${s.session_date}-${s.student_id}`}
                          className={`rounded-lg border p-3 text-sm shadow-sm ${
                            checkedIn
                              ? "border-emerald-400/70 bg-emerald-50/95 ring-1 ring-emerald-500/25"
                              : "border border-ink/[0.08] bg-canvas"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-medium ${checkedIn ? "text-emerald-950" : "text-ink"}`}>
                              {s.student_name}
                            </p>
                            <span className="rounded-full bg-primary/10 px-2 py-px text-[10px] text-black/80">
                              {s.category_name}
                            </span>
                            {checkedIn ? (
                              <span className="rounded-full bg-emerald-600/95 px-2 py-px text-[10px] font-semibold uppercase text-white">
                                已簽到
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-ink/55">
                            {s.session_date} {s.start_time} – {s.end_time}
                          </p>
                          <p className="mt-1 text-xs text-ink/50">{s.branch_name}</p>
                          <p className="mt-2 text-xs text-ink/70">
                            {s.course_title} · PIN{" "}
                            <span className="font-mono text-primary">{s.checkin_pin}</span>
                            {checkedIn ? (
                              <span className="ml-1 text-[10px] text-emerald-800">✓已扣</span>
                            ) : null}
                          </p>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className={`${coachPortal && mobileCoachTab !== "live" ? "hidden" : ""}`}>
            {liveAside}
          </div>

          {coachPortal && mobileCoachTab === "guide" ? (
            <div className="space-y-3 pb-2">
              <PinFlowGuide />
              <p className="text-center text-[11px] text-ink/45">提示：Master admin 可於學生詳情「課程記錄」查所有課堂 PIN 及試堂紀錄。</p>
            </div>
          ) : null}
        </div>

        {coachPortal ?
          <nav
            className="fixed bottom-0 left-0 right-0 z-[100] border-t border-ink/15 bg-surface/98 pb-[env(safe-area-inset-bottom,0)] shadow-[0_-6px_24px_rgba(45,36,34,0.08)] backdrop-blur-md md:mx-auto md:max-w-lg"
            aria-label="教練日程主選單（日程 · 簽到 · PIN 參考）"
          >
            <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 p-2">
              <button
                type="button"
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-colors sm:text-[12px] ${
                  mobileCoachTab === "calendar"
                    ? "!border-transparent !bg-zinc-800 !text-white shadow-md"
                    : "!border-transparent !bg-transparent !text-zinc-700 hover:!bg-black/[0.04] hover:!text-zinc-900"
                }`}
                aria-current={mobileCoachTab === "calendar" ? "page" : undefined}
                onClick={() => setMobileCoachTab("calendar")}
              >
                <span
                  className={`text-[16px] leading-none ${mobileCoachTab === "calendar" ? "!text-white" : "!text-zinc-700"}`}
                  aria-hidden
                >
                  ▣
                </span>
                日程
              </button>
              <button
                type="button"
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-colors sm:text-[12px] ${
                  mobileCoachTab === "live"
                    ? "!border-transparent !bg-zinc-800 !text-white shadow-md"
                    : "!border-transparent !bg-transparent !text-zinc-700 hover:!bg-black/[0.04] hover:!text-zinc-900"
                }`}
                aria-current={mobileCoachTab === "live" ? "page" : undefined}
                onClick={() => setMobileCoachTab("live")}
              >
                <span
                  className={`text-[16px] leading-none ${mobileCoachTab === "live" ? "!text-white" : "!text-zinc-700"}`}
                  aria-hidden
                >
                  ●
                </span>
                簽到
              </button>
              <button
                type="button"
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-colors sm:text-[12px] ${
                  mobileCoachTab === "guide"
                    ? "!border-transparent !bg-zinc-800 !text-white shadow-md"
                    : "!border-transparent !bg-transparent !text-zinc-700 hover:!bg-black/[0.04] hover:!text-zinc-900"
                }`}
                aria-current={mobileCoachTab === "guide" ? "page" : undefined}
                onClick={() => setMobileCoachTab("guide")}
              >
                <span
                  className={`text-[16px] leading-none ${mobileCoachTab === "guide" ? "!text-white" : "!text-zinc-700"}`}
                  aria-hidden
                >
                  ⎘
                </span>
                PIN／途徑
              </button>
            </div>
          </nav>
        : null}
      </div>
      </>
  );

  if (inPortalLayout) {
    return pageBody;
  }

  return (
    <BackendShell layout={coachPortal ? "coach" : "admin"} title={shellTitle}>
      {pageBody}
    </BackendShell>
  );
}
