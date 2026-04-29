"use client";

/** Course set: lessons 1–10, up to 3 weekdays, course start date calendar, series end from backend. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";

type Branch = {
  id: number;
  name: string;
  address: string;
  business_start_time: string;
  business_end_time: string;
  remarks: string | null;
};
type Coach = { id: number; full_name: string; branch_id: number | null };
type StudentRow = {
  id: number;
  full_name: string;
  phone: string;
  lesson_balance: number;
};

const WD_LABEL = ["Mon 一", "Tue 二", "Wed 三", "Thu 四", "Fri 五", "Sat 六", "Sun 日"];

export default function CourseSetPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [title, setTitle] = useState("PT Course");
  const [branchId, setBranchId] = useState<number | "">("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [totalLessons, setTotalLessons] = useState(8);
  const [weekdays, setWeekdays] = useState<number[]>([0, 2, 4]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [courseStartDate, setCourseStartDate] = useState(today);
  const [timeStart, setTimeStart] = useState("10:00");
  const [timeEnd, setTimeEnd] = useState("11:00");
  const [pickedStudents, setPickedStudents] = useState<number[]>([]);
  const [creditsOnEnroll, setCreditsOnEnroll] = useState(10);
  const [status, setStatus] = useState("");
  const [lastOut, setLastOut] = useState<string>("");
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const selectableCoaches = branchId === "" ? coaches : coaches.filter((coach) => coach.branch_id == null || coach.branch_id === branchId);

  useEffect(() => {
    Promise.all([
      api.branches(),
      api.coaches(),
      api.listStudents()
    ])
      .then(([br, ch, st]) => {
        setBranches(br as Branch[]);
        setCoaches(ch as Coach[]);
        setStudents(st as StudentRow[]);
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d).sort((a, b) => a - b);
      if (prev.length >= 3) return prev;
      return [...prev, d].sort((a, b) => a - b);
    });
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setStatus("");
    setLastOut("");
    if (branchId === "" || coachId === "") {
      setStatus("請選擇分店及教練。");
      return;
    }
    if (weekdays.length < 1) {
      setStatus("請至少選一星期上課日（最多 3 日）。");
      return;
    }
    const scheduledStartIso = new Date(`${courseStartDate}T${timeStart}:00`).toISOString();
    const scheduledEndIso = new Date(`${courseStartDate}T${timeEnd}:00`).toISOString();
    try {
      const json = await api.createCourse({
        title,
        branch_id: Number(branchId),
        coach_id: Number(coachId),
        scheduled_start: scheduledStartIso,
        scheduled_end: scheduledEndIso,
        course_start_date: courseStartDate,
        lesson_weekdays: weekdays,
        total_lessons: totalLessons,
        student_ids: pickedStudents,
        credits_on_enroll: creditsOnEnroll
      });
      const c = json as {
        scheduled_start?: string;
        scheduled_end?: string;
        series_start_date?: string;
        series_end_date?: string;
        total_lessons?: number;
        lesson_weekdays?: number[];
      };
      const endHint = c.series_end_date ? `${c.series_end_date}` : c.scheduled_end;
      setLastOut(`已建立 · 套餐 ${c.total_lessons ?? totalLessons} 堂 · 最後一堂日期約 ${String(endHint)}`);
      setStatus("成功");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <BackendShell title="Course 套餐開課">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white">開課（套餐）</h2>
          <p className="mt-2 text-sm text-zinc-400">
            堂數 1–10；每星期揀一至日（最多 3 個上課日）；用行事曆揀首日。建立後伺服器會計算<strong>預計最後一堂日期</strong>（系列結束）。
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/[0.1] bg-[#141414] p-6">
          <label className="block text-sm">
            <span className="text-zinc-400">課程名稱</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-400">分店（必填）</span>
              <select
                required
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) => {
                  const next = e.target.value === "" ? "" : Number(e.target.value);
                  setBranchId(next);
                  setCoachId("");
                }}
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.address}
                  </option>
                ))}
              </select>
              {selectedBranch && (
                <span className="mt-2 block text-xs leading-5 text-zinc-500">
                  {selectedBranch.address} · {selectedBranch.business_start_time}–{selectedBranch.business_end_time}
                  {selectedBranch.remarks ? ` · ${selectedBranch.remarks}` : ""}
                </span>
              )}
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">教練</span>
              <select
                required
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
                value={coachId === "" ? "" : String(coachId)}
                onChange={(e) => setCoachId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">—</option>
                {selectableCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-zinc-400">首日（開學／套餐起始日）</span>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
              value={courseStartDate}
              onChange={(e) => setCourseStartDate(e.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-400">開始時間</span>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">結束時間</span>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </label>
          </div>

          <div>
            <span className="text-sm text-zinc-400">每星期上課日（最多 3 個，0 = 星期一）</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {WD_LABEL.map((label, idx) => {
                const active = weekdays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleWeekday(idx)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      active
                        ? "border-violet-500 bg-violet-500/20 text-white"
                        : "border-white/[0.15] bg-[#1a1a1a] text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-zinc-500">已選：{weekdays.length}／3</p>
          </div>

          <label className="block text-sm">
            <span className="text-zinc-400">套餐堂數（1–10）</span>
            <input
              type="number"
              min={1}
              max={10}
              required
              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
              value={totalLessons}
              onChange={(e) => setTotalLessons(Number(e.target.value))}
            />
          </label>

          <fieldset className="text-sm">
            <legend className="text-zinc-400">編入學員（可多選）</legend>
            <div className="mt-2 max-h-44 space-y-1 overflow-auto rounded-lg border border-white/[0.08] p-2">
              {students.map((s) => {
                const on = pickedStudents.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-[#262626]/80">
                    <input type="checkbox" checked={on} onChange={() => setPickedStudents((prev) =>
                      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])
                    }
                    />
                    <span>{s.full_name}</span>
                    <span className="text-xs text-zinc-500">{s.phone}</span>
                  </label>
                );
              })}
              {students.length === 0 && <p className="text-xs text-zinc-500">未有學生資料</p>}
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="text-zinc-400">入學加分堂數 credits_on_enroll</span>
            <input
              type="number"
              min={0}
              max={200}
              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-zinc-100"
              value={creditsOnEnroll}
              onChange={(e) => setCreditsOnEnroll(Number(e.target.value))}
            />
          </label>

          <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            建立課程
          </button>
        </form>

        {status && (
          <p className={`text-sm ${status === "成功" ? "text-emerald-400" : "text-rose-300"}`}>
            {status}
            {lastOut && (
              <>
                {" "}
                · {lastOut}
              </>
            )}
          </p>
        )}
      </div>
    </BackendShell>
  );
}
