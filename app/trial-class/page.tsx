"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Trial / add-on class booking and PIN handoff
 * Logic: Staff lookup by phone, POST trial-class; loading overlays; success with PINs + wa.me link (``text=Hello``).
 */

import { FormEvent, useEffect, useState } from "react";
import { alertApiError, api } from "../../lib/api";
import type { BranchDto, CoachDto, CourseCategoryDto, MemberProfile, TrialClassCreateResponse } from "../../types/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

/** E.164-ish → wa.me digits (no +). HK 8 digits → 852… */
function digitsForWhatsApp(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 8) return `852${d}`;
  return d;
}

function whatsappPrefillUrl(phone: string, text: string): string {
  return `https://wa.me/${digitsForWhatsApp(phone)}?text=${encodeURIComponent(text)}`;
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

  const [kinds, setKinds] = useState<CourseCategoryDto[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [coaches, setCoaches] = useState<CoachLite[]>([]);
  const [sessionMode, setSessionMode] = useState<"TRIAL" | "ADD_ON">("TRIAL");
  const [courseCategoryId, setCourseCategoryId] = useState<number | "">("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPayload, setSuccessPayload] = useState<TrialClassCreateResponse | null>(null);

  useEffect(() => {
    void Promise.all([api.publicCourseCategories(), api.publicBranches(), api.publicCoaches()])
      .then(([k, b, c]) => {
        const kindRows = Array.isArray(k) ? (k as CourseCategoryDto[]) : [];
        const branchRows = Array.isArray(b) ? (b as BranchLite[]) : [];
        const coachRows = Array.isArray(c) ? (c as CoachLite[]) : [];
        setKinds(kindRows);
        setBranches(branchRows);
        setCoaches(coachRows);
        if (kindRows.length && courseCategoryId === "") setCourseCategoryId(kindRows[0].id);
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
    if (courseCategoryId === "") {
      setStatus("請選擇課程種類。");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSubmitBusy(true);
    setStatus("");
    try {
      const res = (await api.createTrialClass({
        student_id: member.id,
        type: sessionMode,
        course_category_id: Number(courseCategoryId),
        coach_id: coachId === "" ? null : Number(coachId),
        branch_id: branchId === "" ? null : Number(branchId),
        class_date: form.get("class_date"),
        note: form.get("note")
      })) as TrialClassCreateResponse;
      setSuccessPayload(res);
      setSuccessOpen(true);
      if (res.member) setMember(res.member);
    } catch (err) {
      alertApiError(err);
    } finally {
      setSubmitBusy(false);
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
          <span className="text-ink/70">課程種類（由資料庫載入）</span>
          <select
            name="course_category_id"
            value={courseCategoryId === "" ? "" : String(courseCategoryId)}
            onChange={(e) => setCourseCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="" disabled>
              請選擇
            </option>
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
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
          disabled={submitBusy}
          className="w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-primary disabled:opacity-60"
        >
          {submitBusy ? "提交中…" : "提交"}
        </button>
        {status && (
          <p role="alert" className="text-sm text-amber-800">
            {status}
          </p>
        )}
      </form>

      {lookupBusy && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-labelledby="trial-lookup-loading-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-6 shadow-lg ring-1 ring-ink/[0.06]">
            <p id="trial-lookup-loading-title" className="text-center text-lg font-semibold text-ink">
              查找學員中…
            </p>
            <p className="mt-2 text-center text-sm text-ink/60">請稍候。</p>
          </div>
        </div>
      )}

      {submitBusy && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-labelledby="trial-submit-loading-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-6 shadow-lg ring-1 ring-ink/[0.06]">
            <p id="trial-submit-loading-title" className="text-center text-lg font-semibold text-ink">
              提交中…
            </p>
            <p className="mt-2 text-center text-sm text-ink/60">請稍候，正在記錄試堂／加堂。</p>
          </div>
        </div>
      )}

      {successOpen && successPayload && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trial-success-title"
        >
          <div className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-6 shadow-lg ring-1 ring-ink/[0.06]">
            <h2 id="trial-success-title" className="text-lg font-semibold text-ink">
              試堂/加堂已記錄
            </h2>
            <p className="mt-2 text-sm text-ink/70">
              {successPayload.member.full_name}（{successPayload.member.phone}）
            </p>

            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-4">
              <p className="text-sm font-medium text-emerald-950">簽到 PIN（以課程為單位）</p>
              {successPayload.course_checkin_pins && successPayload.course_checkin_pins.length > 0 ? (
                <ul className="space-y-2 text-sm text-emerald-950">
                  {successPayload.course_checkin_pins.map((row) => (
                    <li key={row.course_id} className="border-t border-emerald-200/60 pt-2 first:border-t-0 first:pt-0">
                      <span className="block text-ink/70">
                        {row.course_title} · {row.branch_name}
                      </span>
                      <span className="font-mono text-lg font-semibold tracking-wide">{row.checkin_pin}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-900/90">
                  未有課程 PIN（試堂僅加 ledger 時可能未開課）。請於後台「Course 套餐開課」或職員查閱。
                </p>
              )}
            </div>

            {(() => {
              const waUrl = whatsappPrefillUrl(successPayload.member.phone, "Hello");
              return (
                <div className="mt-4 rounded-lg border border-ink/20 bg-canvas px-3 py-3">
                  <p className="text-sm font-semibold text-ink">已加堂並發送示範 WhatsApp。</p>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block break-all text-sm font-medium text-ink underline underline-offset-2 hover:opacity-80"
                  >
                    {waUrl}
                  </a>
                </div>
              );
            })()}

            <button
              type="button"
              className="mt-5 w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink hover:bg-primary"
              onClick={() => {
                setSuccessOpen(false);
                setSuccessPayload(null);
              }}
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
