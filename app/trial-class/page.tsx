"use client";

import { FormEvent, useEffect, useState } from "react";
import { alertApiError, api } from "../../lib/api";
import type { BranchDto, CoachDto, MemberProfile, TrialClassKindDto } from "../../types/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

function pickDefaultBranchId(branches: BranchLite[]): number | "" {
  const tst = branches.find((b) => b.code === "TST" || b.name.includes("尖沙咀"));
  return tst?.id ?? (branches[0]?.id ?? "");
}

function pickDefaultCoachId(coaches: CoachLite[]): number | "" {
  const fung = coaches.find((c) => c.full_name.toLowerCase().includes("fung"));
  return fung?.id ?? (coaches[0]?.id ?? "");
}

type BranchLite = Pick<BranchDto, "id" | "name" | "code">;
type CoachLite = Pick<CoachDto, "id" | "full_name">;

export default function TrialClassPage() {
  const [phone, setPhone] = useState("");
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [lookupMsg, setLookupMsg] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  const [kinds, setKinds] = useState<TrialClassKindDto[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [coaches, setCoaches] = useState<CoachLite[]>([]);
  const [sessionMode, setSessionMode] = useState<"TRIAL" | "ADD_ON">("TRIAL");
  const [trialKindId, setTrialKindId] = useState<number | "">("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void Promise.all([api.trialClassKinds(), api.publicBranches(), api.publicCoaches()])
      .then(([k, b, c]) => {
        const kindRows = Array.isArray(k) ? (k as TrialClassKindDto[]) : [];
        const branchRows = Array.isArray(b) ? (b as BranchLite[]) : [];
        const coachRows = Array.isArray(c) ? (c as CoachLite[]) : [];
        setKinds(kindRows);
        setBranches(branchRows);
        setCoaches(coachRows);
        if (kindRows.length && trialKindId === "") setTrialKindId(kindRows[0].id);
        const bid = pickDefaultBranchId(branchRows);
        if (bid !== "" && branchId === "") setBranchId(bid);
        const cid = pickDefaultCoachId(coachRows);
        if (cid !== "" && coachId === "") setCoachId(cid);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults once branches/coaches arrive
  }, []);

  async function lookupStudent() {
    const q = inputToLookupPhone(phone);
    if (!q) {
      setLookupMsg("請輸入電話號碼。");
      setMember(null);
      return;
    }
    setLookupBusy(true);
    setLookupMsg("");
    try {
      const row = (await api.memberLookupByPhone(q)) as MemberProfile;
      setMember(row);
    } catch {
      setMember(null);
      setLookupMsg("找不到此電話的學員。");
    } finally {
      setLookupBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) {
      setStatus("請先輸入電話並按「查找學員」。");
      return;
    }
    if (trialKindId === "") {
      setStatus("請選擇學員類型（一對一／一對二）。");
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await api.createTrialClass({
        student_id: member.id,
        type: sessionMode,
        trial_kind_id: Number(trialKindId),
        coach_id: coachId === "" ? null : Number(coachId),
        branch_id: branchId === "" ? null : Number(branchId),
        class_date: form.get("class_date"),
        note: form.get("note")
      });
      setStatus("試堂/加堂已記錄。");
    } catch (err) {
      alertApiError(err);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-canvas p-6 text-ink">
      <h1 className="text-2xl font-semibold">試堂 / 加堂</h1>
      <section className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5 space-y-3">
        <p className="text-sm text-ink/65">學員電話（預設香港 +852，可只填八位）</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例如 91234567"
            className="min-w-[12rem] flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2"
            autoComplete="tel"
          />
          <button
            type="button"
            disabled={lookupBusy}
            onClick={() => void lookupStudent()}
            className="rounded-md border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary disabled:opacity-60"
          >
            {lookupBusy ? "查找中…" : "查找學員"}
          </button>
        </div>
        {lookupMsg && <p className="text-sm text-amber-800">{lookupMsg}</p>}
      </section>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
        <p className="text-sm text-ink/65">
          已選擇：
          {member ? `${member.full_name}（${member.phone}）` : "未選擇 — 請先用電話查找"}
        </p>

        <label className="block space-y-1 text-sm">
          <span className="text-ink/70">試堂 / 加堂</span>
          <select
            name="session_mode_ui"
            value={sessionMode}
            onChange={(e) => setSessionMode(e.target.value as "TRIAL" | "ADD_ON")}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="TRIAL">試堂</option>
            <option value="ADD_ON">加堂</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-ink/70">學員類型（由資料庫載入）</span>
          <select
            name="trial_kind_id"
            value={trialKindId === "" ? "" : String(trialKindId)}
            onChange={(e) => setTrialKindId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="" disabled>
              請選擇
            </option>
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label_zh}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-ink/70">教練（預設 Fung Lo）</span>
          <select
            value={coachId === "" ? "" : String(coachId)}
            onChange={(e) => setCoachId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
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
          <span className="text-ink/70">分店（預設尖沙咀）</span>
          <select
            value={branchId === "" ? "" : String(branchId)}
            onChange={(e) => setBranchId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="">請選擇</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <input name="class_date" type="date" defaultValue={today()} className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
        <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
        <button
          type="submit"
          className="w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
        >
          提交
        </button>
        {status && (
          <p role="alert" className="text-sm text-emerald-800">
            {status}
          </p>
        )}
      </form>
    </main>
  );
}
