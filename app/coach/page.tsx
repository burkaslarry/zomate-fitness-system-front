"use client";

/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: Coach timetable, optional course assign (ADMIN/CLERK), loading/success modals
 * Logic: ``/api/coach/courses``; staff-only ``/api/admin/courses/by-day`` + assign-coach; coach CRUD.
 */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { alertApiError, api, downloadCsv, uploadCsv } from "../../lib/api";
import { getAuthSession } from "../../lib/auth";

type Coach = { id: number; full_name: string; phone: string; branch_id: number | null };
type BranchLite = { id: number; name: string; code: string };
type Enr = { student_id: number; student_name: string; student_phone: string; checkin_pin: string };
type CourseRow = {
  id: number;
  title: string;
  branch_name: string;
  branch_address: string;
  coach_id: number;
  coach_name: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: Enr[];
};

type BlockUi =
  | null
  | { mode: "loading"; title: string; detail?: string }
  | { mode: "success"; title: string; detail?: string };

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
  const [dayCoursesAll, setDayCoursesAll] = useState<CourseRow[]>([]);
  const [blockUi, setBlockUi] = useState<BlockUi>(null);
  const [editingCoachId, setEditingCoachId] = useState<number | null>(null);
  const [canAssignStaff, setCanAssignStaff] = useState(false);

  useEffect(() => {
    const r = getAuthSession()?.role;
    setCanAssignStaff(r === "ADMIN" || r === "CLERK");
  }, []);

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
    if (coachId === "") {
      setCourses([]);
      setDayCoursesAll([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const mine = (await api.coachCourses(Number(coachId), { day })) as CourseRow[];
        const all = canAssignStaff ? ((await api.adminCoursesByDay(day)) as CourseRow[]) : [];
        if (!cancelled) {
          setCourses(mine);
          setDayCoursesAll(all);
        }
      } catch (e) {
        if (!cancelled) {
          setCourses([]);
          setDayCoursesAll([]);
          alertApiError(e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, day, canAssignStaff]);

  async function reschedule(e: FormEvent<HTMLFormElement>, courseId: number) {
    e.preventDefault();
    if (coachId === "") return;
    const form = new FormData(e.currentTarget);
    const start = form.get("scheduled_start") as string;
    const end = form.get("scheduled_end") as string;
    setBlockUi({ mode: "loading", title: "更新課堂時間…", detail: "請稍候。" });
    try {
      await api.rescheduleCourse(courseId, Number(coachId), {
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString()
      });
      setCourses((await api.coachCourses(Number(coachId), { day })) as CourseRow[]);
      if (canAssignStaff) {
        setDayCoursesAll((await api.adminCoursesByDay(day)) as CourseRow[]);
      }
      setBlockUi({ mode: "success", title: "已更新課堂時間。" });
    } catch (err) {
      setBlockUi(null);
      alertApiError(err);
    }
  }

  async function assignCourseToSelectedCoach(courseId: number) {
    if (coachId === "" || !canAssignStaff) return;
    setBlockUi({ mode: "loading", title: "指派教練中…", detail: "將課程系列歸於目前選擇嘅教練。" });
    try {
      await api.assignCourseCoach(courseId, Number(coachId));
      setCourses((await api.coachCourses(Number(coachId), { day })) as CourseRow[]);
      setDayCoursesAll((await api.adminCoursesByDay(day)) as CourseRow[]);
      setBlockUi({ mode: "success", title: "指派成功", detail: "該課程已顯示於上方「此教練嘅課程」。" });
    } catch (err) {
      setBlockUi(null);
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
    setBlockUi({ mode: "loading", title: "新增教練中…" });
    try {
      await api.createCoach({ full_name, phone, branch_id });
      e.currentTarget.reset();
      await reloadCoaches();
      setBlockUi({ mode: "success", title: "教練已新增。" });
    } catch (err) {
      setBlockUi(null);
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
    setBlockUi({ mode: "loading", title: "更新教練資料…" });
    try {
      await api.updateCoach(coach.id, {
        full_name,
        phone,
        branch_id
      });
      setEditingCoachId(null);
      await reloadCoaches();
      setBlockUi({ mode: "success", title: "教練資料已更新。" });
    } catch (err) {
      setBlockUi(null);
      alertApiError(err);
    }
  }

  async function onDeleteCoach(coach: Coach, hard: boolean) {
    const msg = hard
      ? `確定永久刪除「${coach.full_name}」？（無關連課堂方可）`
      : `確定刪除「${coach.full_name}」？將作軟刪除，列表唔再顯示。`;
    if (!window.confirm(msg)) return;
    setBlockUi({ mode: "loading", title: "處理中…" });
    try {
      await api.deleteCoach(coach.id, hard);
      await reloadCoaches();
      setBlockUi({ mode: "success", title: hard ? "已永久刪除。" : "已軟刪除。" });
    } catch (err) {
      setBlockUi(null);
      alertApiError(err);
    }
  }

  async function onImportCoachCsv(file: File) {
    setBlockUi({ mode: "loading", title: "匯入教練 CSV…" });
    try {
      const r = await uploadCsv("/api/admin/coaches/import", file);
      await reloadCoaches();
      setBlockUi({ mode: "success", title: `匯入完成：${r.imported ?? 0} 筆。` });
    } catch (err) {
      setBlockUi(null);
      alertApiError(err);
    }
  }

  function branchName(bid: number | null) {
    if (bid == null) return "—";
    const b = branches.find((x) => x.id === bid);
    return b ? `${b.name} (${b.code})` : `#${bid}`;
  }

  const selectedCoach = typeof coachId === "number" ? coaches.find((c) => c.id === coachId) : undefined;
  const assignableOthers =
    coachId === "" ? [] : dayCoursesAll.filter((c) => c.coach_id !== Number(coachId));

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <BackendShell title="教練課表">
      <main className="w-full max-w-[min(100%,88rem)] space-y-6 p-6">
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

        {canAssignStaff && coachId !== "" && (
          <section className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/40 p-4">
            <h3 className="text-sm font-semibold text-ink">
              同日其他課程 — 指派畀「{selectedCoach?.full_name ?? "此教練"}」
            </h3>
            <p className="mt-1 text-xs text-ink/55">
              以下為所選日期有堂嘅全部課程系列中，尚未歸於此教練嘅項目；按「指派」將整個課程系列改由目前教練負責。
            </p>
            {assignableOthers.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">目前沒有可指派嘅其他課程。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {assignableOthers.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 text-ink">
                      <span className="font-medium">{c.title}</span>
                      <span className="text-ink/60">
                        {" "}
                        · 現任教練：{c.coach_name} · {c.branch_name}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-primary/50 bg-primary/85 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-primary"
                      onClick={() => void assignCourseToSelectedCoach(c.id)}
                    >
                      指派
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <h2 className="text-base font-semibold text-ink">此教練於選定日期嘅課程</h2>
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

        {blockUi?.mode === "loading" && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
            role="alertdialog"
            aria-busy="true"
            aria-live="polite"
            aria-labelledby="coach-block-loading-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-6 shadow-lg ring-1 ring-ink/[0.06]">
              <p id="coach-block-loading-title" className="text-center text-lg font-semibold text-ink">
                {blockUi.title}
              </p>
              {blockUi.detail ? (
                <p className="mt-2 text-center text-sm text-ink/60">{blockUi.detail}</p>
              ) : null}
            </div>
          </div>
        )}

        {blockUi?.mode === "success" && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-block-success-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-6 shadow-lg ring-1 ring-ink/[0.06]">
              <p id="coach-block-success-title" className="text-center text-lg font-semibold text-emerald-900">
                {blockUi.title}
              </p>
              {blockUi.detail ? (
                <p className="mt-2 text-center text-sm text-ink/70">{blockUi.detail}</p>
              ) : null}
              <button
                type="button"
                className="mt-5 w-full rounded-lg border border-ink/15 bg-primary/90 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-primary"
                onClick={() => setBlockUi(null)}
              >
                確定
              </button>
            </div>
          </div>
        )}
      </main>
    </BackendShell>
  );
}
