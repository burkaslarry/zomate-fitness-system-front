"use client";

/**
 * [F001][S003]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Membership renewal form for students.
 */

import { FormEvent, useState } from "react";
import { alertApiError, api } from "../../lib/api";
import type { MemberProfile, PackageDto } from "../../types/api";
import FileUpload from "../../components/forms/file-upload";
import PaymentMethodRadio from "../../components/forms/payment-method-radio";
import SelectAsync from "../../components/forms/select-async";

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

export default function RenewalPage() {
  const [phone, setPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [status, setStatus] = useState("");

  async function lookup() {
    const q = inputToLookupPhone(phone);
    if (!q) {
      setStatus("請輸入電話號碼。");
      return;
    }
    setLookupBusy(true);
    setStatus("");
    try {
      const row = (await api.memberLookupByPhone(q)) as MemberProfile;
      setMember(row);
      setPackages((await api.packages()) as PackageDto[]);
    } catch (err) {
      setMember(null);
      alertApiError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const form = new FormData(event.currentTarget);
    const receipt = form.get("receipt");
    try {
      setStatus("提交續會中…");
      const payload: Parameters<typeof api.createRenewal>[0] = {
        student_id: member.id,
        package_id: Number(form.get("package_id")),
        coach_id: Number(form.get("coach_id")) || undefined,
        branch_id: Number(form.get("branch_id")) || undefined,
        amount: String(form.get("amount") ?? "0"),
        payment_method: String(form.get("payment_method") ?? ""),
        note: String(form.get("note") ?? ""),
        receipt: receipt instanceof File && receipt.name ? receipt : null
      };
      if (member.hkid) {
        payload.member_hkid = member.hkid;
      }
      await api.createRenewal(payload);
      setStatus("續會完成，已更新堂數及收據記錄。");
    } catch (err) {
      alertApiError(err);
      setStatus("");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-canvas p-6 text-ink">
      <h1 className="text-2xl font-semibold">續會 Renewal</h1>
      <section className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
        <p className="mb-3 text-sm text-ink/65">Step 1 · 電話查找（預設香港 +852，可只填八位數字）</p>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="電話（例如 91234567）"
            className="flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2"
            autoComplete="tel"
          />
          <button
            type="button"
            disabled={lookupBusy}
            onClick={() => void lookup()}
            className="rounded-md border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary disabled:opacity-60"
          >
            {lookupBusy ? "…" : "搜尋"}
          </button>
        </div>
      </section>
      {member && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
          <p className="text-sm text-ink/65">
            Step 2 · Read-only member: <strong className="text-ink">{member.full_name}</strong> · {member.phone}
            {member.hkid ? ` · HKID ${member.hkid}` : ""}
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">Package</span>
            <select name="package_id" required className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink">
              <option value="">請選擇</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} · {pkg.sessions} 堂
                </option>
              ))}
            </select>
          </label>
          <SelectAsync name="coach_id" label="教練" load={api.publicCoaches} />
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} />
          <input name="amount" required inputMode="decimal" placeholder="收費" className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
          <PaymentMethodRadio />
          <FileUpload name="receipt" label="收據 upload" required />
          <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
          <button
            type="submit"
            className="w-full rounded-md border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-semibold text-ink hover:bg-emerald-100"
          >
            提交續會
          </button>
          {status && <p className="text-sm text-emerald-800">{status}</p>}
        </form>
      )}
    </main>
  );
}
