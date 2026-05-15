"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: (see Logic)
 * Logic: Branches, coaches, course-set admin surfaces.
 */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type { BranchDto, CoachDto, MemberProfile, TrialClassKindDto } from "../../../types/api";

/** Python `enumerate_lesson_dates`: 0 = Monday … 6 = Sunday */
const WEEK_LOOKUP: { day: number; label: string; zh: string }[] = [
  { day: 0, label: "Mon", zh: "一" },
  { day: 1, label: "Tue", zh: "二" },
  { day: 2, label: "Wed", zh: "三" },
  { day: 3, label: "Thu", zh: "四" },
  { day: 4, label: "Fri", zh: "五" },
  { day: 5, label: "Sat", zh: "六" },
  { day: 6, label: "Sun", zh: "日" }
];

function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${t}`;
}

export default function AdminCourseSetPage() {
  const [kinds, setKinds] = useState<TrialClassKindDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [students, setStudents] = useState<MemberProfile[]>([]);
  const [studentFilter, setStudentFilter] = useState("");
  const [kindId, setKindId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [courseDate, setCourseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [totalLessons, setTotalLessons] = useState(10);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [k, b, c, s] = await Promise.all([
          api.trialClassKinds(),
          api.publicBranches(),
          api.publicCoaches(),
          api.listStudents()
        ]);
        if (cancelled) return;
        setKinds(Array.isArray(k) ? (k as TrialClassKindDto[]) : []);
        setBranches(Array.isArray(b) ? (b as BranchDto[]) : []);
        setCoaches(Array.isArray(c) ? (c as CoachDto[]) : []);
        setStudents(Array.isArray(s) ? (s as MemberProfile[]) : []);
      } catch (e) {
        if (!cancelled) alertApiError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const branchDetail = useMemo(() => branches.find((x) => x.id === branchId), [branches, branchId]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= 3) return prev;
      return [...prev, d].sort((a, b) => a - b);
    });
  }

  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.full_name} ${s.phone}`.toLowerCase().includes(q));
  }, [studentFilter, students]);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setStatus("");
    const titleKind = kinds.find((x) => x.id === kindId);
    if (!titleKind || !branchId || !coachId) {
      setStatus("請選擇課程種類、分店與教練。");
      return;
    }
    if (weekdays.length < 1) {
      setStatus("請選擇至少一個上課日（最多三個）。");
      return;
    }
    const student_ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([id]) => Number(id));
    const scheduled_start = combineLocalDateTime(courseDate, startTime);
    const scheduled_end = combineLocalDateTime(courseDate, endTime);
    if (scheduled_end <= scheduled_start) {
      setStatus("結束時間須晚於開始時間。");
      return;
    }
    try {
      await api.createCourse({
        title: titleKind.label_zh,
        branch_id: branchId,
        coach_id: coachId,
        scheduled_start,
        scheduled_end,
        student_ids,
        course_start_date: courseDate,
        lesson_weekdays: weekdays,
        total_lessons: totalLessons
      });
      setStatus("課程已建立。");
      setPicked({});
    } catch (e) {
      alertApiError(e);
    }
  }

  return (
    <BackendShell title="Course 套餐開課">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink">開課（套餐）</h2>
          <p className="mt-2 text-sm text-ink/65">
            堂數 1–10；每星期揀一至日（最多 3 個上課日）；用行事曆揀首日。建立後伺服器會計算預計最後一堂日期（系列結束）。編入學員時，餘額會按{" "}
            <strong className="font-medium text-ink">套餐堂數</strong> 加入。
          </p>
          <p className="mt-1 text-xs text-ink/50">
            課程種類請先到{" "}
            <Link href="/admin/branches" className="underline underline-offset-4">
              分店管理 → Course 種類
            </Link>{" "}
            設定。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-ink/55">載入中…</p>
        ) : kinds.length === 0 ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
            目前沒有啟用的課程種類。請至{" "}
            <Link href="/admin/branches" className="font-medium underline">
              分店管理
            </Link>{" "}
            啟用至少一種。
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm ring-1 ring-ink/[0.04]">
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">課程名稱</span>
              <select
                required
                value={kindId === "" ? "" : String(kindId)}
                onChange={(e) => setKindId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇（來自 Course 種類）</option>
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label_zh}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">分店（必填）</span>
              <select
                required
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.address}
                  </option>
                ))}
              </select>
              {branchDetail ? (
                <span className="text-xs text-ink/55">
                  {[
                    branchDetail.address,
                    branchDetail.business_start_time && branchDetail.business_end_time
                      ? `${branchDetail.business_start_time}–${branchDetail.business_end_time}`
                      : null,
                    branchDetail.remarks
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">教練</span>
              <select
                required
                value={coachId === "" ? "" : String(coachId)}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">首日（開學／套餐起始日）</span>
              <input
                type="date"
                required
                value={courseDate}
                onChange={(e) => setCourseDate(e.target.value)}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-ink/70">開始時間</span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-ink/70">結束時間</span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-ink/70">每星期上課日（最多 3 個）</span>
              <div className="flex flex-wrap gap-2">
                {WEEK_LOOKUP.map(({ day, label, zh }) => {
                  const on = weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        on
                          ? "border-primary bg-primary/15 text-ink shadow-[inset_0_0_0_1px_rgba(45,36,34,0.08)]"
                          : "border-ink/15 bg-canvas text-ink/55 hover:border-ink/25"
                      }`}
                    >
                      {label} {zh}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink/50">已選：{weekdays.length}/3</p>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">套餐堂數（1–10）</span>
              <input
                type="number"
                required
                min={1}
                max={10}
                value={totalLessons}
                onChange={(e) => setTotalLessons(Number(e.target.value))}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink sm:max-w-[12rem]"
              />
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="text-sm text-ink/70">編入學員（可多選）</span>
                <input
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  placeholder="篩選姓名／電話…"
                  className="max-w-xs flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-1.5 text-xs text-ink"
                />
              </div>
              <div className="max-h-56 overflow-auto rounded-lg border border-ink/10 bg-canvas">
                <table className="w-full border-collapse text-left text-sm">
                  <colgroup>
                    <col style={{ width: 24 }} />
                    <col />
                    <col />
                  </colgroup>
                  <thead className="sticky top-0 border-b border-ink/10 bg-surface text-xs text-ink/60">
                    <tr>
                      <th className="p-1.5" aria-label="選取" />
                      <th className="px-2 py-2 font-medium">姓名</th>
                      <th className="px-2 py-2 font-medium">電話</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="border-b border-ink/[0.06]">
                        <td className="p-1 align-middle">
                          <input
                            type="checkbox"
                            checked={Boolean(picked[s.id])}
                            onChange={(e) =>
                              setPicked((prev) => ({
                                ...prev,
                                [s.id]: e.target.checked
                              }))
                            }
                            className="ml-0.5 h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-2 py-2 text-ink">{s.full_name}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-ink/80">{s.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {status ? <p className="text-sm text-emerald-800">{status}</p> : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:w-auto"
            >
              建立課程
            </button>
          </form>
        )}
      </div>
    </BackendShell>
  );
}
