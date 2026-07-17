"use client";

/**
 * [F008][S004]
 * Feature: Coach Session Management
 * Step: Admin staff day view — 教練上堂
 * Logic: Coach picker, date + category filter, session list, Excel export.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import CoachCategoryFilter from "../../components/coach-category-filter";
import { alertApiError, api } from "../../lib/api";
import { getAuthSession } from "../../lib/auth";

type CoachOpt = { id: number; full_name: string };
type SessionRow = {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_phone: string;
  category_id: number | null;
  category_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  branch_name: string;
  checkin_pin: string;
  coach_time_confirmed: boolean;
  attendance_status: string;
  course_title: string;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CoachStaffDayPage() {
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const s = getAuthSession();
    if (!s) return;
    if (s.role === "COACH") {
      window.location.replace("/coach-portal");
      return;
    }
    if (s.role !== "ADMIN" && s.role !== "CLERK") {
      setDenied(true);
      setReady(true);
      return;
    }
    setReady(true);
    void api
      .coaches()
      .then((list) => {
        const arr = list as CoachOpt[];
        setCoaches(arr);
        if (arr.length) setCoachId(arr[0].id);
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  const loadSessions = useCallback(async () => {
    if (coachId === "") return;
    setLoading(true);
    try {
      const rows = (await api.coachSessions(Number(coachId), {
        day: selectedDay,
        categoryIds: categoryIds.length ? categoryIds : undefined
      })) as SessionRow[];
      setSessions(rows ?? []);
      setStatus("");
    } catch (e) {
      setSessions([]);
      setStatus(String(e));
    } finally {
      setLoading(false);
    }
  }, [coachId, selectedDay, categoryIds]);

  useEffect(() => {
    if (!ready || coachId === "") return;
    void loadSessions();
  }, [ready, coachId, loadSessions]);

  async function exportExcel() {
    if (coachId === "") return;
    setExporting(true);
    try {
      await api.downloadCoachSessionsExport(
        Number(coachId),
        { day: selectedDay, categoryIds: categoryIds.length ? categoryIds : undefined },
        `coach-sessions-${selectedDay}.csv`
      );
    } catch (e) {
      alertApiError(e);
    } finally {
      setExporting(false);
    }
  }

  if (!ready) return null;

  if (denied) {
    return (
      <BackendShell title="教練上堂">
        <p className="text-sm text-ink/70">此頁面僅供職員帳號使用。</p>
      </BackendShell>
    );
  }

  return (
    <BackendShell title="教練上堂">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">教練上堂</h1>
            <p className="mt-1 text-sm text-ink/55">
              職員檢視指定教練的學員上堂日程；可篩選課程類型並匯出 Excel。
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              href="/coach/attendance"
              className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-center text-sm font-medium text-black hover:border-primary/60"
            >
              教練出勤（月報）→
            </Link>
            <Link
              href="/coach/calendar"
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-center text-sm font-medium text-ink hover:border-primary/40"
            >
              學生上堂（月曆）→
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            <label className="block w-full text-sm text-ink sm:min-w-[12rem] sm:w-auto">
              教練
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-full text-sm text-ink sm:w-auto">
              日期
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-canvas px-2 py-2 text-ink"
              />
            </label>
            <div className="flex items-end sm:col-auto">
              <button
                type="button"
                disabled={exporting || coachId === ""}
                onClick={() => void exportExcel()}
                className="w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50 sm:w-auto"
              >
                {exporting ? "匯出中…" : "匯出 Excel"}
              </button>
            </div>
          </div>
          <CoachCategoryFilter
            className="mt-4"
            coachId={coachId}
            selectedIds={categoryIds}
            onChange={setCategoryIds}
          />
        </section>

        {status ? <p className="text-sm text-rose-600">{status}</p> : null}

        <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">
            {selectedDay} · {loading ? "載入中…" : `${sessions.length} 堂`}
          </h2>
          {sessions.length === 0 && !loading ? (
            <p className="mt-3 text-sm text-ink/50">此日無符合條件的上堂紀錄。</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/[0.06]">
              {sessions.map((s) => (
                <li key={`${s.enrollment_id}-${s.session_date}-${s.student_id}`} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{s.student_name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-black/80">
                      {s.category_name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        s.attendance_status === "已簽到"
                          ? "bg-emerald-500/15 text-emerald-800"
                          : "bg-ink/5 text-ink/55"
                      }`}
                    >
                      {s.attendance_status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/60">
                    {s.start_time}–{s.end_time} · {s.branch_name} · PIN {s.checkin_pin}
                  </p>
                  <p className="text-xs text-ink/45">{s.course_title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </BackendShell>
  );
}
