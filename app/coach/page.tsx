"use client";

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { api } from "../../lib/api";

type Coach = { id: number; full_name: string; phone: string; branch_id: number | null };
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

export default function CoachPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api
      .coaches()
      .then((list) => {
        const arr = list as Coach[];
        setCoaches(arr);
        if (arr.length) {
          setCoachId((prev) => (prev === "" ? arr[0].id : prev));
        }
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  useEffect(() => {
    if (coachId === "") return;
    api
      .coachCourses(Number(coachId), day)
      .then((c) => setCourses(c as CourseRow[]))
      .catch((e) => setStatus(String(e)));
  }, [coachId, day]);

  async function reschedule(e: FormEvent<HTMLFormElement>, courseId: number) {
    e.preventDefault();
    if (coachId === "") return;
    const form = new FormData(e.currentTarget);
    const start = form.get("scheduled_start") as string;
    const end = form.get("scheduled_end") as string;
    setStatus("更新中…");
    try {
      await api.rescheduleCourse(courseId, Number(coachId), {
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString()
      });
      setStatus("已更新課堂時間。");
      const c = (await api.coachCourses(Number(coachId), day)) as CourseRow[];
      setCourses(c);
    } catch (err) {
      setStatus(String(err));
    }
  }

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <BackendShell title="教練課表">
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-white">教練 · 課堂日程</h1>
        </div>
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[#333] bg-[#171717] p-4">
        <label className="text-sm text-slate-200">
          教練
          <select
            className="mt-1 block min-w-[12rem]"
            value={coachId === "" ? "" : String(coachId)}
            onChange={(ev) => setCoachId(ev.target.value ? Number(ev.target.value) : "")}
          >
            <option value="">— 選擇 —</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-200">
          日期（預設今日）
          <input type="date" className="mt-1 block" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
      </div>
      {status && <p className="text-sm text-amber-300">{status}</p>}
      <div className="space-y-4">
        {courses.length === 0 && <p className="text-sm text-slate-300">當日未有課堂，或請先喺後台建立課堂。</p>}
        {courses.map((c) => (
          <article key={c.id} className="rounded-lg border border-[#333] bg-[#171717] p-4 shadow-sm">
            <h2 className="font-semibold text-white">{c.title}</h2>
            <p className="text-sm text-slate-300">
              {c.branch_name} · {c.branch_address}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(c.scheduled_start).toLocaleString()} → {new Date(c.scheduled_end).toLocaleString()}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {c.enrollments.map((e) => (
                <li key={e.student_id}>
                  {e.student_name}（{e.student_phone}）· 課堂 PIN <span className="font-mono">{e.checkin_pin}</span>
                </li>
              ))}
            </ul>
            <form className="mt-3 grid gap-2 border-t border-[#333] pt-3 md:grid-cols-2" onSubmit={(ev) => reschedule(ev, c.id)}>
              <input
                type="datetime-local"
                name="scheduled_start"
                defaultValue={toLocalInput(c.scheduled_start)}
                required
              />
              <input
                type="datetime-local"
                name="scheduled_end"
                defaultValue={toLocalInput(c.scheduled_end)}
                required
              />
              <div className="md:col-span-2">
                <button type="submit" className="text-sm">
                  更改日期時間
                </button>
              </div>
            </form>
          </article>
        ))}
      </div>
      </main>
    </BackendShell>
  );
}
