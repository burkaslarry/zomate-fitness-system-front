"use client";

/**
 * [F003][S002]
 * Feature: Coach authentication
 * Step: Admin coaches grid + login username/password on create and edit
 * Logic: POST/PATCH /api/admin/coaches with login_username and password fields.
 */

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { CoachDto, CourseCategoryDto } from "../../../types/api";
import SelectAsync from "../../../components/forms/select-async";

function fmtHireDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("zh-HK", { dateStyle: "medium" });
}

type EditForm = {
  full_name: string;
  phone: string;
  specialty: string;
  hire_date: string;
  login_username: string;
  password: string;
};

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachDto[]>([]);
  const [status, setStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "phone">("name");
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<CoachDto | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [skillsCoach, setSkillsCoach] = useState<CoachDto | null>(null);
  const [allCategories, setAllCategories] = useState<CourseCategoryDto[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<number>>(new Set());
  const [skillsBusy, setSkillsBusy] = useState(false);

  async function load() {
    const q = searchQ.trim();
    const data = (await api.coaches(q ? { q, search_by: searchBy } : undefined)) as CoachDto[];
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load().catch((err) => setStatus(String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change via Search button
  }, []);

  async function runSearch() {
    setStatus("");
    try {
      await load();
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const form = new FormData(event.currentTarget);
    const hireRaw = String(form.get("hire_date") ?? "").trim();
    const loginUsername = String(form.get("login_username") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();
    try {
      await api.createCoach({
        full_name: String(form.get("full_name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        branch_id: Number(form.get("branch_id")) || null,
        ...(hireRaw ? { hire_date: hireRaw } : {}),
        ...(loginUsername ? { login_username: loginUsername } : {}),
        ...(password ? { password } : {})
      });
      setFormKey((k) => k + 1);
      setStatus("教練已建立。");
      await load();
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function deactivate(id: number) {
    await api.updateCoach(id, { active: false });
    await load();
  }

  async function openSkillsModal(row: CoachDto) {
    setSkillsCoach(row);
    setSkillsBusy(true);
    setStatus("");
    try {
      const [catsRaw, skillsRaw] = await Promise.all([
        api.courseCategories() as Promise<CourseCategoryDto[]>,
        api.getCoachSkills(row.id) as Promise<{ course_category_ids?: number[] }>
      ]);
      const cats = Array.isArray(catsRaw) ? catsRaw.filter((c) => c.is_active !== false && c.is_deleted !== true) : [];
      setAllCategories(cats);
      const ids = Array.isArray(skillsRaw?.course_category_ids) ? skillsRaw.course_category_ids : row.skill_category_ids ?? [];
      setSelectedSkillIds(new Set(ids));
    } catch (err) {
      setStatus(String(err));
      setSkillsCoach(null);
    } finally {
      setSkillsBusy(false);
    }
  }

  async function saveSkills() {
    if (!skillsCoach) return;
    setSkillsBusy(true);
    setStatus("");
    try {
      await api.setCoachSkills(skillsCoach.id, Array.from(selectedSkillIds));
      setStatus(`已更新 ${skillsCoach.full_name} 的課程權限。`);
      setSkillsCoach(null);
      await load();
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSkillsBusy(false);
    }
  }

  function toggleSkill(categoryId: number) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function startEdit(row: CoachDto) {
    setEditing(row);
    setEditForm({
      full_name: row.full_name,
      phone: row.phone,
      specialty: row.specialty ?? "",
      hire_date: row.hire_date?.slice(0, 10) ?? "",
      login_username: row.login_username ?? "",
      password: ""
    });
    setStatus("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editForm) return;
    setStatus("");
    try {
      const payload: Parameters<typeof api.updateCoach>[1] = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        specialty: editForm.specialty.trim() || null,
        hire_date: editForm.hire_date.trim() || null,
        login_username: editForm.login_username.trim() || undefined
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await api.updateCoach(editing.id, payload);
      setEditing(null);
      setEditForm(null);
      setStatus("教練資料已更新。");
      await load();
    } catch (err) {
      setStatus(String(err));
    }
  }

  const todayIso = () => new Date().toISOString().slice(0, 10);

  return (
    <BackendShell title="教練管理">
      <div className="mx-auto max-w-5xl space-y-5">
        <h2 className="text-2xl font-semibold text-ink">教練管理</h2>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
          <label className="space-y-1 text-sm">
            <span className="text-ink/70">搜尋欄位</span>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as "name" | "phone")}
              className="block rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
            >
              <option value="name">姓名</option>
              <option value="phone">電話</option>
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 space-y-1 text-sm">
            <span className="text-ink/70">關鍵字</span>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={searchBy === "phone" ? "電話一部份…" : "姓名一部份…"}
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            onClick={() => void runSearch()}
            className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
          >
            搜尋
          </button>
        </div>

        <form
          key={formKey}
          onSubmit={submit}
          className="grid gap-3 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04] md:grid-cols-2 lg:grid-cols-3"
        >
          <input name="full_name" required placeholder="教練姓名" className="rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          <input name="phone" required placeholder="電話" className="rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          <SelectAsync name="branch_id" label="分店（預設尖沙咀）" load={api.publicBranches} defaultBranchCode="TST" />
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">入職日期</span>
            <input type="date" name="hire_date" defaultValue={todayIso()} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          </label>
          <input name="login_username" placeholder="登入帳號（選填）" className="rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="登入密碼（選填，≥6 字）"
            className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
          />
          <p className="text-xs text-ink/55 lg:col-span-3">
            填寫帳號＋密碼會建立 COACH 登入；帳號可留空（以姓名拼音自動產生）。教練登入後使用 /coach。
          </p>
          <button className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary lg:col-span-3 lg:justify-self-start">
            新增
          </button>
        </form>

        {editing && editForm && (
          <form
            onSubmit={saveEdit}
            className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3"
          >
            <h3 className="text-lg font-semibold text-ink lg:col-span-3">編輯教練 · {editing.full_name}</h3>
            <input
              required
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              placeholder="教練姓名"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <input
              required
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="電話"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <input
              value={editForm.specialty}
              onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
              placeholder="Specialty"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">入職日期</span>
              <input
                type="date"
                value={editForm.hire_date}
                onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm"
              />
            </label>
            <input
              value={editForm.login_username}
              onChange={(e) => setEditForm({ ...editForm, login_username: e.target.value })}
              placeholder="登入帳號"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="新密碼（留空不變）"
              className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
            />
            <div className="flex gap-2 lg:col-span-3">
              <button
                type="submit"
                className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
              >
                儲存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
                className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm text-ink"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {status && <p className="text-sm text-emerald-800">{status}</p>}
        <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full border-collapse text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[72px]" />
              <col className="min-w-[180px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-ink/10 bg-surface text-ink/65 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">姓名</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">電話</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">登入帳號</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">分店</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">入職日期</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 font-medium">學員（已報此教練課程）</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={`border-b border-ink/[0.06] text-ink/85 ${i % 2 === 1 ? "bg-canvas/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-ink">{row.full_name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.phone}</td>
                  <td className="px-4 py-3 text-xs">{row.login_username ?? "—"}</td>
                  <td className="px-4 py-3">{row.branch_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{fmtHireDate(row.hire_date)}</td>
                  <td className="px-4 py-3 align-top">
                    {row.active !== false ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">在職</span>
                    ) : (
                      <span className="rounded-full bg-ink/10 px-2 py-1 text-xs text-ink/60">停用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs leading-relaxed text-ink/80">
                    {row.enrolled_students && row.enrolled_students.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-ink/50">共 {row.enrolled_students.length} 位</div>
                        <ul className="space-y-1">
                          {row.enrolled_students.map((s) => (
                            <li key={s.id}>
                              <span className="font-medium text-ink">{s.full_name}</span>
                              <span className="text-ink/50"> · {s.phone}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="text-ink/45">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void openSkillsModal(row)}
                        className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-ink hover:bg-primary/20"
                      >
                        課程權限
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="rounded-md border border-ink/15 bg-canvas px-3 py-1 text-xs text-ink hover:border-primary/40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deactivate(row.id)}
                        className="rounded-md border border-ink/15 bg-canvas px-3 py-1 text-xs text-ink hover:border-rose-300/60"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {skillsCoach ? (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-skills-title"
          >
            <div className="w-full max-w-lg space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 shadow-xl">
              <h3 id="coach-skills-title" className="text-lg font-semibold text-ink">
                教練課程權限分配 · {skillsCoach.full_name}
              </h3>
              <p className="text-xs text-ink/60">勾選此教練可教授的課程種類（新會員登記時會依此過濾）。</p>
              {skillsBusy && allCategories.length === 0 ? (
                <p className="text-sm text-ink/50">載入中…</p>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-ink/10 bg-canvas p-3 sm:grid-cols-2">
                  {allCategories.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-ink/10 bg-surface px-2 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selectedSkillIds.has(cat.id)}
                        onChange={() => toggleSkill(cat.id)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={skillsBusy}
                  onClick={() => void saveSkills()}
                  className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => setSkillsCoach(null)}
                  className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm text-ink"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </BackendShell>
  );
}
