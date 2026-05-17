"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Admin coaches grid + enrolled students (courses under this coach)
 * Logic: GET /api/admin/coaches returns enrolled_students; table column lists names/phones.
 */

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { CoachDto } from "../../../types/api";
import SelectAsync from "../../../components/forms/select-async";

function fmtHireDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("zh-HK", { dateStyle: "medium" });
}

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachDto[]>([]);
  const [status, setStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "phone">("name");
  const [formKey, setFormKey] = useState(0);

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
    const form = new FormData(event.currentTarget);
    const hireRaw = String(form.get("hire_date") ?? "").trim();
    await api.createCoach({
      full_name: String(form.get("full_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      branch_id: Number(form.get("branch_id")) || null,
      ...(hireRaw ? { hire_date: hireRaw } : {})
    });
    setFormKey((k) => k + 1);
    setStatus("教練已建立。");
    await load();
  }

  async function deactivate(id: number) {
    await api.updateCoach(id, { active: false });
    await load();
  }

  async function edit(row: CoachDto) {
    const fullName = window.prompt("教練姓名", row.full_name);
    if (!fullName) return;
    const phone = window.prompt("電話", row.phone);
    if (!phone) return;
    const specialty = window.prompt("Specialty", row.specialty ?? "") ?? "";
    const hdDefault = row.hire_date?.slice(0, 10) ?? "";
    const hirePrompt = window.prompt("入職日期 (YYYY-MM-DD，留空則清除)", hdDefault);
    if (hirePrompt === null) return;
    const hireTrim = hirePrompt.trim();
    let hire_date: string | null;
    if (!hireTrim) hire_date = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(hireTrim)) {
      setStatus("入職日期格式須為 YYYY-MM-DD");
      return;
    } else hire_date = hireTrim;

    await api.updateCoach(row.id, {
      full_name: fullName,
      phone,
      specialty: specialty || null,
      hire_date
    });
    setStatus("");
    await load();
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
          className="grid gap-3 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04] md:grid-cols-2 lg:grid-cols-4"
        >
          <input name="full_name" required placeholder="教練姓名" className="rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          <input name="phone" required placeholder="電話" className="rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          <SelectAsync name="branch_id" label="分店（預設尖沙咀）" load={api.publicBranches} defaultBranchCode="TST" />
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">入職日期</span>
            <input type="date" name="hire_date" defaultValue={todayIso()} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm" />
          </label>
          <button className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary lg:col-span-4 lg:justify-self-start">
            新增
          </button>
        </form>
        {status && <p className="text-sm text-emerald-800">{status}</p>}
        <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full border-collapse text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[72px]" />
              <col className="min-w-[200px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-ink/10 bg-surface text-ink/65 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">姓名</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">電話</th>
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
                        <div className="text-[11px] font-medium text-ink/50">
                          共 {row.enrolled_students.length} 位
                        </div>
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
                        onClick={() => void edit(row)}
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
      </div>
    </BackendShell>
  );
}
