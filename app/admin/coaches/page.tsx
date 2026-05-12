"use client";

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { CoachDto } from "../../../types/api";
import SelectAsync from "../../../components/forms/select-async";

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachDto[]>([]);
  const [status, setStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "phone">("name");

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
    await api.createCoach({
      full_name: String(form.get("full_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      branch_id: Number(form.get("branch_id")) || null
    });
    event.currentTarget.reset();
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
    await api.updateCoach(row.id, { full_name: fullName, phone, specialty: specialty || null });
    await load();
  }

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

        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04] md:grid-cols-2">
          <input name="full_name" required placeholder="教練姓名" />
          <input name="phone" required placeholder="電話" />
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} />
          <button className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary md:self-end">
            新增
          </button>
        </form>
        {status && <p className="text-sm text-emerald-800">{status}</p>}
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-ink/65">
              <tr>
                <th className="px-4 py-2">姓名</th>
                <th className="px-4 py-2">電話</th>
                <th className="px-4 py-2">分店</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-ink/[0.06] text-ink/85">
                  <td className="px-4 py-3 font-medium text-ink">{row.full_name}</td>
                  <td className="px-4 py-3">{row.phone}</td>
                  <td className="px-4 py-3">{row.branch_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
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
