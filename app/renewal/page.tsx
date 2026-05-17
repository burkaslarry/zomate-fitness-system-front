"use client";

/**
 * [F001][S003]
 * Feature: Student Onboarding
 * Step: Membership renewal (報堂)
 * Logic: Phone lookup → member chip → 課程種類 + 套餐 + coach/branch + payment; POST /api/renewals includes `course_category_id` when backend supports it (persist via category enrollment / ledger — not legacy `course_enrollments` alone).
 */

import { FormEvent, useEffect, useState } from "react";
import { alertApiError, api } from "../../lib/api";
import type { CourseCategoryDto, MemberProfile, PackageDto } from "../../types/api";
import FileUpload from "../../components/forms/file-upload";
import PaymentMethodRadio from "../../components/forms/payment-method-radio";
import SelectAsync from "../../components/forms/select-async";

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

/** [F001][S003] Step 2 phone chip: show 8-digit HK local when stored as +852… */
function displayHongKongPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("852")) return d.slice(3);
  if (d.length === 8) return d;
  return raw.trim();
}

/** [F001][S003] 收費必填：非空且為有效正數（可含逗號）。 */
function isValidRenewalAmount(raw: string): boolean {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

/** [F001][S003] Admin list may include soft-deleted categories — hide in staff renewal form. */
function activeCourseCategories(rows: unknown): CourseCategoryDto[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r): r is CourseCategoryDto => {
    if (!r || typeof r !== "object" || !("id" in r) || !("name" in r)) return false;
    const c = r as CourseCategoryDto;
    if (c.is_deleted) return false;
    if (c.deleted_at) return false;
    return true;
  });
}

export default function RenewalPage() {
  const [phone, setPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [courseCategories, setCourseCategories] = useState<CourseCategoryDto[]>([]);
  const [amount, setAmount] = useState("");
  /** Step 1 inline hint (e.g. empty phone). */
  const [lookupHint, setLookupHint] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalSuccessMessage, setRenewalSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setAmount("");
  }, [member?.id]);

  async function lookup() {
    const q = inputToLookupPhone(phone);
    if (!q) {
      setLookupHint("請輸入電話號碼。");
      return;
    }
    setLookupBusy(true);
    setLookupHint("");
    try {
      const [row, pkgs, catsRaw] = await Promise.all([
        api.memberLookupByPhone(q) as Promise<MemberProfile>,
        api.packages() as Promise<PackageDto[]>,
        api.courseCategories(false).catch(() => [])
      ]);
      setMember(row);
      setPackages(Array.isArray(pkgs) ? pkgs : []);
      setCourseCategories(activeCourseCategories(catsRaw));
    } catch (err) {
      setMember(null);
      setCourseCategories([]);
      alertApiError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    if (courseCategories.length === 0) {
      console.error("[F001][S003] Renewal submit blocked: no course categories loaded (admin session or API required).");
      return;
    }
    const form = new FormData(event.currentTarget);
    const amountRaw = String(form.get("amount") ?? "");
    if (!isValidRenewalAmount(amountRaw)) {
      console.error("[F001][S003] Renewal submit blocked: missing or invalid amount.");
      return;
    }
    const receipt = form.get("receipt");
    try {
      setRenewalSubmitting(true);
      setRenewalSuccessMessage(null);
      const payload: Parameters<typeof api.createRenewal>[0] = {
        student_id: member.id,
        course_category_id: (() => {
          const n = Number(form.get("course_category_id"));
          return Number.isFinite(n) && n > 0 ? n : undefined;
        })(),
        package_id: Number(form.get("package_id")),
        coach_id: Number(form.get("coach_id")) || undefined,
        branch_id: Number(form.get("branch_id")) || undefined,
        amount: amountRaw.trim().replace(/,/g, ""),
        payment_method: String(form.get("payment_method") ?? ""),
        note: String(form.get("note") ?? ""),
        receipt: receipt instanceof File && receipt.name ? receipt : null
      };
      if (member.hkid) {
        payload.member_hkid = member.hkid;
      }
      await api.createRenewal(payload);
      setRenewalSuccessMessage("報堂完成，已更新堂數及收據記錄。");
    } catch (err) {
      alertApiError(err);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-canvas p-6 text-ink">
      <h1 className="text-2xl font-semibold">會員報堂</h1>
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
        {lookupHint ? <p className="mt-2 text-sm text-amber-800">{lookupHint}</p> : null}
      </section>
      {member && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
          <p className="text-sm text-ink/65">
            Step 2 · Members: <strong className="text-ink">{member.full_name}</strong> · {displayHongKongPhone(member.phone)}
            {member.hkid ? ` · HKID ${member.hkid}` : ""}
          </p>
          {courseCategories.length === 0 ? (
            <p className="text-xs text-amber-800">
              未能載入課程種類。請以後台帳戶登入後再按「搜尋」，或聯絡管理員。（續會 API 需一併處理課程種類與套餐／堂數入帳，單靠舊版 enrollment 表未必記錄套餐或試堂額度。）
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">課程種類（Course category）</span>
            <select
              name="course_category_id"
              required={courseCategories.length > 0}
              disabled={courseCategories.length === 0}
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink disabled:opacity-60"
            >
              <option value="">{courseCategories.length ? "請選擇" : "無可用課程種類"}</option>
              {courseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">套餐</span>
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
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} defaultFirst />
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="收費 (HKD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          />
          <PaymentMethodRadio />
          <FileUpload name="receipt" label="收據 upload（選填）" />
          <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
          <button
            type="submit"
            disabled={renewalSubmitting || courseCategories.length === 0 || !isValidRenewalAmount(amount)}
            className="w-full rounded-md border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-semibold text-ink hover:bg-emerald-100 disabled:opacity-50"
          >
            現正報堂
          </button>
        </form>
      )}

      {/* [F001][S003] Renewal submit — loading overlay */}
      {renewalSubmitting ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-live="polite"
          aria-label="提交中"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-ink/10 bg-surface px-6 py-8 shadow-xl ring-1 ring-ink/[0.06]">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
            <p className="text-center text-sm font-medium text-ink">提交中…</p>
            <p className="text-center text-xs text-ink/55">請稍候，勿關閉頁面。</p>
          </div>
        </div>
      ) : null}

      {/* [F001][S003] Renewal submit — success popup */}
      {renewalSuccessMessage ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="renewal-success-title">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-5 text-ink shadow-xl ring-1 ring-ink/[0.06]">
            <h2 id="renewal-success-title" className="text-lg font-semibold">報堂成功</h2>
            <p className="text-sm text-ink/80">{renewalSuccessMessage}</p>
            <button
              type="button"
              className="w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
              onClick={() => setRenewalSuccessMessage(null)}
            >
              關閉
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
