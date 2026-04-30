"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { alertApiError, api } from "../../lib/api";
import type { MemberProfile, PackageDto } from "../../types/api";
import FileUpload from "../../components/forms/file-upload";
import PaymentMethodRadio from "../../components/forms/payment-method-radio";
import SelectAsync from "../../components/forms/select-async";

export default function RenewalPage() {
  const router = useRouter();
  const [hkid, setHkid] = useState("");
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [status, setStatus] = useState("");

  async function lookup() {
    try {
      const row = (await api.member(hkid)) as MemberProfile;
      setMember(row);
      setPackages((await api.packages()) as PackageDto[]);
      setStatus("");
    } catch {
      router.push("/register");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member?.hkid) return;
    const form = new FormData(event.currentTarget);
    const receipt = form.get("receipt");
    try {
      setStatus("提交續會中…");
      await api.createRenewal({
        member_hkid: member.hkid,
        package_id: Number(form.get("package_id")),
        coach_id: Number(form.get("coach_id")) || undefined,
        branch_id: Number(form.get("branch_id")) || undefined,
        amount: String(form.get("amount") ?? "0"),
        payment_method: String(form.get("payment_method") ?? ""),
        note: String(form.get("note") ?? ""),
        receipt: receipt instanceof File && receipt.name ? receipt : null
      });
      setStatus("續會完成，已更新堂數及收據記錄。");
    } catch (err) {
      alertApiError(err);
      setStatus("");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-zinc-950 p-6 text-white">
      <h1 className="text-2xl font-semibold">續會 Renewal</h1>
      <section className="rounded-xl border border-white/15 bg-[#141414] p-5">
        <p className="mb-3 text-sm text-white/70">Step 1 · HKID lookup</p>
        <div className="flex gap-2">
          <input value={hkid} onChange={(e) => setHkid(e.target.value)} placeholder="HKID" className="flex-1 rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
          <button type="button" onClick={() => void lookup()} className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium">搜尋</button>
        </div>
      </section>
      {member && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-white/15 bg-[#141414] p-5">
          <p className="text-sm text-white/70">Step 2 · Read-only member: <strong className="text-white">{member.full_name}</strong> · {member.phone}</p>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-300">Package</span>
            <select name="package_id" required className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-white">
              <option value="">請選擇</option>
              {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.sessions} 堂</option>)}
            </select>
          </label>
          <SelectAsync name="coach_id" label="教練" load={api.publicCoaches} />
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} />
          <input name="amount" required inputMode="decimal" placeholder="收費" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
          <PaymentMethodRadio />
          <FileUpload name="receipt" label="收據 upload" required />
          <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2" />
          <button type="submit" className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold">提交續會</button>
          {status && <p className="text-sm text-emerald-300">{status}</p>}
        </form>
      )}
    </main>
  );
}
