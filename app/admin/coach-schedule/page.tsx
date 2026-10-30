"use client";

/**
 * [F008][S007]
 * Feature: Coach Session Management
 * Step: Admin 教練課堂排程 board
 * Logic: Google-style calendar (教練曆 parity) over GET /api/coach/sessions?all_coaches=true;
 *        multi-coach filter chips, overlapping lessons in lanes.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import CoachScheduleCalendarNav, {
  type CalendarMode
} from "../../../components/coach-schedule-calendar-nav";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";
import { type CoachSessionRow } from "../../../lib/coach-sessions";

function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** [F008][S007] Load a month plus one week either side so 3-day/週 views cross months. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = new Date(Date.UTC(y, m - 1, 1 - 7));
  const to = new Date(Date.UTC(y, m - 1, last + 7));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}

export default function AdminCoachSchedulePage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [mode, setMode] = useState<CalendarMode>("day");
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [sessions, setSessions] = useState<CoachSessionRow[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const session = getAuthSession();
    if (!session) return;
    if (session.role === "COACH") {
      window.location.replace("/coach-portal");
      return;
    }
    setAllowed(session.role === "ADMIN" || session.role === "CLERK");
  }, []);

  const month = monthOf(selectedDay);

  const loadMonth = useCallback(async () => {
    if (!month) return;
    const { from, to } = monthRange(month);
    setLoading(true);
    try {
      const rows = (await api.coachSessions("all", { fromDate: from, toDate: to })) as CoachSessionRow[];
      setSessions(Array.isArray(rows) ? rows : []);
      setStatus("");
    } catch (e) {
      alertApiError(e);
      setSessions([]);
      setStatus("無法載入教練課堂排程，請確認帳號權限或 API。");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (allowed) void loadMonth();
  }, [allowed, loadMonth]);

  // [F008][S007] One chip per coach; no selection = all coaches.
  const coachNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of sessions) names.add((s.coach_name || "未指派教練").trim());
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const visibleSessions = useMemo(
    () =>
      selectedCoaches.size === 0
        ? sessions
        : sessions.filter((s) => selectedCoaches.has((s.coach_name || "未指派教練").trim())),
    [sessions, selectedCoaches]
  );

  const daySessions = useMemo(
    () => visibleSessions.filter((s) => s.session_date === selectedDay),
    [visibleSessions, selectedDay]
  );

  const dayCheckedIn = daySessions.filter((s) => s.attendance_status === "已簽到").length;
  const monthCheckedIn = visibleSessions.filter((s) => s.attendance_status === "已簽到").length;

  const monthCoachSummary = useMemo(() => {
    const map = new Map<string, { total: number; checkedIn: number; confirmed: number }>();
    for (const s of visibleSessions) {
      if (!s.session_date.startsWith(month)) continue;
      const coach = (s.coach_name || "未指派教練").trim();
      const row = map.get(coach) ?? { total: 0, checkedIn: 0, confirmed: 0 };
      row.total += 1;
      if (s.attendance_status === "已簽到") row.checkedIn += 1;
      if (s.coach_time_confirmed) row.confirmed += 1;
      map.set(coach, row);
    }
    return Array.from(map.entries())
      .map(([coach, stats]) => ({ coach, ...stats }))
      .sort((a, b) => b.total - a.total || a.coach.localeCompare(b.coach));
  }, [visibleSessions, month]);

  function toggleCoach(name: string) {
    setSelectedCoaches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (allowed === false) {
    return (
      <BackendShell title="教練課堂排程">
        <p className="text-sm text-ink/70">此頁面僅供職員帳號使用。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="教練課堂排程">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">教練課堂排程</h2>
            <p className="mt-1 text-sm text-ink/65">
              同教練曆一樣嘅 Google 式日曆：可同時揀多位教練，教班時段容許重疊。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/coach"
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
            >
              教練上堂 →
            </Link>
            <Link
              href="/coach/calendar"
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
            >
              學生上堂月曆 →
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">每日（{selectedDay || "—"}）</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {daySessions.length}
            </dd>
            <p className="mt-1 text-[11px] text-ink/45">已簽到 {dayCheckedIn} 堂</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">每月（{month || "—"}）</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {visibleSessions.filter((s) => s.session_date.startsWith(month)).length}
            </dd>
            <p className="mt-1 text-[11px] text-ink/45">已簽到 {monthCheckedIn} 堂</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">本月教練</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {monthCoachSummary.length}
            </dd>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">本月未簽到</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {Math.max(
                0,
                visibleSessions.filter((s) => s.session_date.startsWith(month)).length - monthCheckedIn
              )}
            </dd>
          </div>
        </dl>

        <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">揀教練（可多選）</p>
            <p className="text-xs text-ink/45">
              {loading ? "載入中…" : `${monthLabel(month)} · ${visibleSessions.length} 堂`}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCoaches(new Set())}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                selectedCoaches.size === 0
                  ? "border-primary bg-primary/15 font-medium text-black"
                  : "border-ink/15 bg-canvas text-ink/70"
              }`}
            >
              全部教練
            </button>
            {coachNames.map((name) => {
              const active = selectedCoaches.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleCoach(name)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? "border-primary bg-primary/15 font-medium text-black"
                      : "border-ink/15 bg-canvas text-ink/70 hover:border-primary/30"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </section>

        {status ? <p className="text-sm text-rose-600">{status}</p> : null}

        <section className="rounded-2xl border border-ink/10 bg-surface p-2 shadow-sm sm:p-4">
          <CoachScheduleCalendarNav
            selectedDay={selectedDay}
            mode={mode}
            rangeSessions={visibleSessions}
            onSelectDay={setSelectedDay}
            onModeChange={setMode}
            onNavigate={setSelectedDay}
            showCoach
          />
        </section>

        <section className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 sm:px-4">
            <h3 className="text-sm font-semibold text-ink">本月教練統計</h3>
            <p className="text-[11px] text-ink/50">堂數 · 已簽到 · 時間已確認</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-y border-ink/10 bg-canvas/80 text-xs text-ink/55">
              <tr>
                <th className="px-3 py-2 font-semibold">教練</th>
                <th className="px-3 py-2 text-right font-semibold">本月堂數</th>
                <th className="px-3 py-2 text-right font-semibold">已簽到</th>
                <th className="px-3 py-2 text-right font-semibold">時間已確認</th>
              </tr>
            </thead>
            <tbody>
              {monthCoachSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink/50">
                    {loading ? "載入中…" : "本月沒有教練課堂。"}
                  </td>
                </tr>
              ) : (
                monthCoachSummary.map((row) => (
                  <tr key={row.coach} className="border-b border-ink/[0.06] last:border-0">
                    <td className="px-3 py-2 font-medium text-ink">{row.coach}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/80">{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{row.checkedIn}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{row.confirmed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </BackendShell>
  );
}
