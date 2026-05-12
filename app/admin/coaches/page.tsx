"use client";

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { CoachDto } from "../../../types/api";
import SelectAsync from "../../../components/forms/select-async";

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachDto[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    setRows((await api.publicCoaches()) as CoachDto[]);
  }

  useEffect(() => {
    void load().catch((err) => setStatus(String(err)));
  }, []);

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
        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04] md:grid-cols-2">
          <input name="full_name" required placeholder="教練姓名" />
          <input name="phone" required placeholder="電話" />
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} />
          <button className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary md:self-end">
            新增
          </button>
        </form>
        {status && <p className="text-sm text-emerald-800">{status}</p>}
        <div className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-b border-ink/10 px-4 py-3 text-sm text-ink">
              <span>{row.full_name} · {row.phone}</span>
              <div className="flex gap-2">
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
            </div>
          ))}
        </div>
      </div>
    </BackendShell>
  );
}
