"use client";

import { FormEvent, useEffect, useState } from "react";
import { alertApiError, api } from "../../lib/api";
import type { MemberProfile } from "../../types/api";
import SelectAsync from "../../components/forms/select-async";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TrialClassPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<MemberProfile[]>([]);
  const [selected, setSelected] = useState<MemberProfile | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!q.trim()) {
      setRows([]);
      return;
    }
    const t = setTimeout(() => {
      api.memberSearch(q).then((data) => setRows(Array.isArray(data) ? (data as MemberProfile[]) : [])).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.hkid) {
      setStatus("請先選擇學生。");
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await api.createTrialClass({
        member_hkid: selected.hkid,
        type: form.get("type"),
        coach_id: Number(form.get("coach_id")) || null,
        branch_id: Number(form.get("branch_id")) || null,
        class_date: form.get("class_date"),
        note: form.get("note")
      });
      setStatus("試堂/加堂已記錄。");
    } catch (err) {
      alertApiError(err);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-zinc-950 p-6 text-white">
      <h1 className="text-2xl font-semibold">試堂 / 加堂</h1>
      <section className="rounded-xl border border-white/15 bg-[#141414] p-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="HKID / 姓名 / 電話 autocomplete" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
        {rows.length > 0 && (
          <div className="mt-2 space-y-1">
            {rows.map((row) => (
              <button key={row.id} type="button" onClick={() => setSelected(row)} className="block w-full rounded-md bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/15">
                {row.full_name} · {row.hkid} · {row.phone}
              </button>
            ))}
          </div>
        )}
      </section>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-white/15 bg-[#141414] p-5">
        <p className="text-sm text-white/70">已選擇：{selected ? `${selected.full_name} (${selected.hkid})` : "未選擇"}</p>
        <select name="type" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2">
          <option value="TRIAL">試堂</option>
          <option value="ADD_ON">加堂</option>
        </select>
        <SelectAsync name="coach_id" label="教練" load={api.publicCoaches} />
        <SelectAsync name="branch_id" label="分店" load={api.publicBranches} />
        <input name="class_date" type="date" defaultValue={today()} className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
        <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
        <button type="submit" className="w-full rounded-md bg-[#6366f1] px-4 py-3 text-sm font-semibold">提交</button>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
      </form>
    </main>
  );
}
