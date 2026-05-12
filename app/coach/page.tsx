"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { alertApiError, api, downloadCsv, uploadCsv } from "../../lib/api";

type Coach = { id: number; full_name: string; phone: string; branch_id: number | null };
type BranchLite = { id: number; name: string; code: string };
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

const INPUT =
  "mt-1 block w-full max-w-xl rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink/50";
const SELECT_CTL =
  "!w-auto max-w-xl min-w-[12rem] rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm text-ink outline-none [&>option]:bg-surface [&>option]:text-ink";

export default function CoachPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [status, setStatus] = useState("");
  const [editingCoachId, setEditingCoachId] = useState<number | null>(null);

  const reloadCoaches = useCallback(async () => {
    const list = (await api.coaches()) as Coach[];
    setCoaches(list);
    setCoachId((prev) => {
      if (typeof prev === "number" && list.some((c) => c.id === prev)) return prev;
      return list.length ? list[0].id : "";
    });
  }, []);

  useEffect(() => {
    void api
      .branches()
      .then((b) => setBranches((b ?? []) as BranchLite[]))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    void reloadCoaches().catch((e) => alertApiError(e));
  }, [reloadCoaches]);

  useEffect(() => {
    if (coachId === "") return;
    api
      .coachCourses(Number(coachId), { day })
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
      const c = (await api.coachCourses(Number(coachId), { day })) as CourseRow[];
      setCourses(c);
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  async function onCreateCoach(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const full_name = String(form.get("full_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const br = String(form.get("branch_id") ?? "");
    const branch_id = br === "" ? null : Number(br);
    setStatus("新增教練中…");
    try {
      await api.createCoach({ full_name, phone, branch_id });
      e.currentTarget.reset();
      await reloadCoaches();
      setStatus("教練已新增。");
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  async function onSaveCoachEdit(coach: Coach, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const full_name = String(form.get("edit_full_name") ?? "").trim();
    const phone = String(form.get("edit_phone") ?? "").trim();
    const br = String(form.get("edit_branch_id") ?? "");
    const branch_id = br === "" ? null : Number(br);
    setStatus("更新教練中…");
    try {
      await api.updateCoach(coach.id, {
        full_name,
        phone,
        branch_id
      });
      setEditingCoachId(null);
      await reloadCoaches();
      setStatus("教練資料已更新。");
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  async function onDeleteCoach(coach: Coach, hard: boolean) {
    const msg = hard
      ? `確定永久刪除「${coach.full_name}」？（無關連課堂方可）`
      : `確定刪除「${coach.full_name}」？將作軟刪除，列表唔再顯示。`;
    if (!window.confirm(msg)) return;
    setStatus("處理中…");
    try {
      await api.deleteCoach(coach.id, hard);
      await reloadCoaches();
      setStatus(hard ? "已永久刪除。" : "已軟刪除。");
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  async function onImportCoachCsv(file: File) {
    setStatus("匯入教練 CSV…");
    try {
      const r = await uploadCsv("/api/admin/coaches/import", file);
      await reloadCoaches();
      setStatus(`匯入完成：${r.imported ?? 0} 筆。`);
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  function branchName(bid: number | null) {
    if (bid == null) return "—";
    const b = branches.find((x) => x.id === bid);
    return b ? `${b.name} (${b.code})` : `#${bid}`;
  }

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <BackendShell title="教練課表">
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/[0.08] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">教練管理</h2>
              <p className="mt-1 text-sm text-ink/55">
                新增／編輯／軟刪除；CSV 欄位：full_name, phone, branch_code（同匯出格式）。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface"
                onClick={() =>
                  downloadCsv("/api/admin/coaches/export.csv", `coaches-${new Date().toISOString().slice(0, 10)}.csv`)
                }
              >
                匯出 CSV
              </button>
              <label className="cursor-pointer rounded-lg bg-indigo-600/70 px-3 py-1.5 text-sm font-medium text-ink hover:bg-indigo-600">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    ev.target.value = "";
                    if (f) void onImportCoachCsv(f);
                  }}
                />
                匯入 CSV
              </label>
            </div>
          </div>

          <form className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={onCreateCoach}>
            <label className="text-sm text-ink/70">
              <span className="mb-1 block font-medium text-ink/55">姓名</span>
              <input name="full_name" required className={`${INPUT} !mt-0`} placeholder="全名" autoComplete="off" />
            </label>
            <label className="text-sm text-ink/70">
              <span className="mb-1 block font-medium text-ink/55">電話</span>
              <input
                name="phone"
                required
                className={`${INPUT} !mt-0`}
                placeholder="+852…"
                inputMode="tel"
                autoComplete="off"
              />
            </label>
            <label className="text-sm text-ink/70 lg:col-span-2">
              <span className="mb-1 block font-medium text-ink/55">分店（可唔揀）</span>
              <select name="branch_id" className={`${SELECT_CTL} mt-1 !max-w-full`}>
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-emerald-100 hover:bg-emerald-500"
              >
                新增教練
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto rounded-lg border border-ink/[0.08]">
            <table className="min-w-full text-left text-sm text-ink/80">
              <thead className="bg-surface shadow-sm ring-1 ring-ink/[0.04] text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-3 py-2">姓名</th>
                  <th className="px-3 py-2">電話</th>
                  <th className="px-3 py-2">分店</th>
                  <th className="px-3 py-2 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {coaches.map((coach) =>
                  editingCoachId === coach.id ? (
                    <tr key={coach.id} className="border-b border-ink/[0.08] bg-canvas/50">
                      <td colSpan={4} className="px-3 py-4">
                        <form
                          className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
                          onSubmit={(ev) => void onSaveCoachEdit(coach, ev)}
                        >
                          <label className="block text-xs text-ink/55">
                            姓名
                            <input name="edit_full_name" required defaultValue={coach.full_name} className={INPUT} />
                          </label>
                          <label className="block text-xs text-ink/55">
                            電話
                            <input name="edit_phone" required defaultValue={coach.phone} className={INPUT} />
                          </label>
                          <label className="block text-xs text-ink/55 md:col-span-2 lg:col-span-2">
                            分店
                            <select
                              name="edit_branch_id"
                              defaultValue={coach.branch_id == null ? "" : String(coach.branch_id)}
                              className={`${SELECT_CTL} !mt-1 !max-w-full`}
                            >
                              <option value="">—</option>
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({b.code})
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-emerald-100 hover:bg-emerald-500"
                            >
                              儲存
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/[0.15] px-4 py-2 text-sm text-ink/70 hover:bg-canvas"
                              onClick={() => setEditingCoachId(null)}
                            >
                              取消
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={coach.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                      <td className="px-3 py-2 font-medium text-ink">{coach.full_name}</td>
                      <td className="px-3 py-2 font-mono text-ink/70">{coach.phone}</td>
                      <td className="px-3 py-2 text-ink/55">{branchName(coach.branch_id)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          className="mr-2 rounded-md border border-violet-400/40 bg-violet-900/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-900/55"
                          onClick={() => setEditingCoachId(coach.id)}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-500/50 px-2 py-1 text-xs text-ink/70 hover:bg-canvas"
                          onClick={() => void onDeleteCoach(coach, false)}
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {coaches.length > 0 && (
            <p className="mt-3 text-xs text-ink/50">
              進階：若該教練確定無任何課堂，需要永久從資料庫移除，可先喺資料庫或課堂管理確認後，再聯繫 ADMIN 或使用 API 嘅 hard delete。
            </p>
          )}
          {coaches.length === 0 && <p className="mt-3 text-sm text-ink/50">目前未有教練，請新增或匯入 CSV。</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-ink">教練 · 課堂日程</h1>
          <Link
            href="/coach/calendar"
            className="text-sm text-primary transition hover:text-ink hover:underline"
          >
            開啟月曆 + 簽到直播 →
          </Link>
        </div>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-ink/10 bg-surface p-4">
          <label className="flex flex-col text-sm text-ink/80">
            <span>教練</span>
            <select
              className={`${SELECT_CTL} mt-1`}
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
          <label className="flex flex-col text-sm text-ink/80">
            <span>日期（預設今日）</span>
            <input
              type="date"
              className={`${INPUT} !mt-1 !w-auto`}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        {status && <p className="text-sm text-amber-900">{status}</p>}
        <div className="space-y-4">
          {courses.length === 0 && (
            <p className="text-sm text-ink/70">當日未有課堂，或請先喺後台建立課堂。</p>
          )}
          {courses.map((c) => (
            <article key={c.id} className="rounded-lg border border-ink/15 bg-surface p-4 shadow-sm">
              <h2 className="font-semibold text-ink">{c.title}</h2>
              <p className="text-sm text-ink/70">
                {c.branch_name} · {c.branch_address}
              </p>
              <p className="text-xs text-ink/55">
                {new Date(c.scheduled_start).toLocaleString()} → {new Date(c.scheduled_end).toLocaleString()}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink/80">
                {c.enrollments.map((e) => (
                  <li key={e.student_id}>
                    {e.student_name}（{e.student_phone}）· 課堂 PIN{" "}
                    <span className="font-mono">{e.checkin_pin}</span>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 grid gap-2 border-t border-ink/15 pt-3 md:grid-cols-2"
                onSubmit={(ev) => reschedule(ev, c.id)}
              >
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
                  <button
                    type="submit"
                    className="rounded-lg border border-ink/10 bg-neutral-700 px-3 py-2 text-sm font-medium text-ink hover:bg-neutral-600"
                  >
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
