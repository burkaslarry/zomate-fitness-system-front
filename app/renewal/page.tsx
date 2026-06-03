"use client";

/**
 * [F001][S003]
 * Feature: Student Onboarding
 * Step: Unified payment / receipt entry before scheduled course PIN generation
 * Logic: Phone lookup → manual fee + 6/4 course-package type selector + payment method; Course Set later creates course PIN.
 */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { alertApiError, api } from "../../lib/api";
import type { MemberProfile, TrialClassKindDto } from "../../types/api";
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

type PurchaseSummary = {
  studentName: string;
  packageName: string;
  coursePackageType: string;
  amountPaid: string;
  remainingBalance: number | null;
  paymentMethod: string;
  firstSessionHint: string;
};

/** [F002][S001] Six client-approved course package types; repeat purchases hide the two `new_*` types. */
const NEW_STUDENT_KIND_CODES = new Set(["new_1to1", "new_1to2"]);

/** [F002][S001] Admin list may include disabled kinds — hide inactive rows from payment entry. */
function activeCoursePackageKinds(rows: unknown, member: MemberProfile): TrialClassKindDto[] {
  if (!Array.isArray(rows)) return [];
  const hasPaidBefore = member.lesson_balance > 0 || member.current_course_package_status !== "No active package";
  return rows.filter((r): r is TrialClassKindDto => {
    if (!r || typeof r !== "object" || !("id" in r) || !("code" in r) || !("label_zh" in r)) return false;
    const kind = r as TrialClassKindDto;
    if (!kind.active) return false;
    if (hasPaidBefore && NEW_STUDENT_KIND_CODES.has(kind.code)) return false;
    return true;
  });
}

export default function RenewalPage() {
  const [phone, setPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [coursePackageKinds, setCoursePackageKinds] = useState<TrialClassKindDto[]>([]);
  const [amount, setAmount] = useState("");
  const [totalLessons, setTotalLessons] = useState(10);
  /** Step 1 inline hint (e.g. empty phone). */
  const [lookupHint, setLookupHint] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [courseKindId, setCourseKindId] = useState<number | "">("");
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary | null>(null);

  /** [F002][S001] Optional query seed for member detail / deprecated routes that forward into unified payment. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seededPhone = params.get("student");
    if (seededPhone) setPhone(seededPhone);
  }, []);

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
      const [row, catsRaw] = await Promise.all([
        api.memberLookupByPhone(q) as Promise<MemberProfile>,
        api.trialClassKinds().catch(() => [])
      ]);
      setMember(row);
      const kinds = activeCoursePackageKinds(catsRaw, row);
      setCoursePackageKinds(kinds);
      setCourseKindId(kinds[0]?.id ?? "");
    } catch (err) {
      setMember(null);
      setCoursePackageKinds([]);
      setCourseKindId("");
      alertApiError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const selectedKind = coursePackageKinds.find((kind) => kind.id === courseKindId);
    if (!selectedKind) {
      console.error("[F002][S001] Payment submit blocked: no course package type selected.");
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
      setPurchaseSummary(null);
      const lessons = Number(form.get("total_lessons"));
      if (!Number.isFinite(lessons) || lessons < 1 || lessons > 30) {
        console.error("[F002][S001] Payment submit blocked: total_lessons must be 1-30.");
        return;
      }
      const paymentMethod = String(form.get("payment_method") ?? "");
      const firstSessionHint = String(form.get("first_session_hint") ?? "").trim();
      const payload: Parameters<typeof api.createRenewal>[0] = {
        student_id: member.id,
        total_lessons: lessons,
        coach_id: Number(form.get("coach_id")) || undefined,
        branch_id: Number(form.get("branch_id")) || undefined,
        amount: amountRaw.trim().replace(/,/g, ""),
        payment_method: paymentMethod,
        transaction_type: NEW_STUDENT_KIND_CODES.has(selectedKind.code) ? "new_package" : "renewal",
        course_package_type_code: selectedKind.code,
        course_package_type_label: selectedKind.label_zh,
        note: `[${selectedKind.label_zh}] 第一堂：${firstSessionHint || "未安排"} ${String(form.get("note") ?? "")}`.trim(),
        receipt: receipt instanceof File && receipt.name ? receipt : null
      };
      if (member.hkid) {
        payload.member_hkid = member.hkid;
      }
      const res = (await api.createRenewal(payload)) as { member?: { lesson_balance?: number } };
      const summary: PurchaseSummary = {
        studentName: member.full_name,
        packageName: `${lessons} 堂（admin 手動輸入）`,
        coursePackageType: selectedKind.label_zh,
        amountPaid: amountRaw.trim().replace(/,/g, ""),
        remainingBalance: typeof res.member?.lesson_balance === "number" ? res.member.lesson_balance : null,
        paymentMethod,
        firstSessionHint: firstSessionHint || "待 Course 套餐開課安排"
      };
      console.log("[F002][S003] Checkout Summary loaded successfully", summary);
      setPurchaseSummary(summary);
    } catch (err) {
      alertApiError(err);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-canvas p-6 text-ink">
      <h1 className="text-2xl font-semibold">Reg Course / Payment First</h1>
      <p className="text-sm text-ink/65">
        先由 admin／文書提交收費、付款方式與分期備註；之後再揀課堂種類與堂數。Course PIN 會喺「Course 套餐開課」按課程產生。
      </p>
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
            Step 2 · Payment first: <strong className="text-ink">{member.full_name}</strong> · {displayHongKongPhone(member.phone)}
            {member.hkid ? ` · HKID ${member.hkid}` : ""}
          </p>
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
          <input
            name="first_session_hint"
            placeholder="第一堂時間（例如 2026-05-20 19:00，可稍後 Course 套餐開課正式安排）"
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          />
          {/* [F002][S001] Client-approved 6/4 package type selector; repeat purchase hides `新學生*`. */}
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">課堂套餐種類 Course Package Type</span>
            <select
              name="course_kind_id"
              value={courseKindId}
              onChange={(e) => setCourseKindId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-purple-300 bg-canvas px-3 py-2 text-ink shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">請選擇</option>
              {coursePackageKinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label_zh}
                </option>
              ))}
            </select>
            <span className="block text-xs text-ink/55">
              新加入學生可選 6 種；報過堂再續會只顯示「續會」及「自帶」4 種。
            </span>
          </label>
          {coursePackageKinds.length === 0 ? (
            <p className="text-xs text-amber-800">
              未能載入課堂套餐種類。請確認 backend 已 seed 6 個 Course Kind，或到分店管理檢查啟用狀態。
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">堂數 Total Lessons（admin 自己輸入）</span>
            <input
              name="total_lessons"
              type="number"
              min={1}
              max={30}
              required
              value={totalLessons}
              onChange={(e) => setTotalLessons(Number(e.target.value))}
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink"
            />
            <span className="block text-xs text-ink/55">PIN 跟 payment/package 或分期，不是每堂一個 PIN。</span>
          </label>
          <SelectAsync name="coach_id" label="教練" load={api.publicCoaches} />
          <SelectAsync name="branch_id" label="分店" load={api.publicBranches} defaultFirst />
          <FileUpload name="receipt" label="收據 upload（選填）" />
          <textarea name="note" rows={3} placeholder="備註" className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2" />
          <button
            type="submit"
            disabled={renewalSubmitting || coursePackageKinds.length === 0 || courseKindId === "" || !isValidRenewalAmount(amount)}
            className="w-full rounded-md border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-semibold text-ink hover:bg-emerald-100 disabled:opacity-50"
          >
            確認付款並產生 Summary
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

      {/* [F002][S003] Checkout Summary Screen — verify parity before returning home. */}
      {purchaseSummary ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="purchase-summary-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-purple-300 bg-surface p-5 text-ink shadow-xl ring-2 ring-purple-500/25">
            <h2 id="purchase-summary-title" className="text-lg font-semibold text-purple-700">確認總覽 Purchase Summary</h2>
            <dl className="grid gap-3 rounded-xl border border-ink/10 bg-canvas p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Student</dt><dd className="font-medium">{purchaseSummary.studentName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Package</dt><dd className="font-medium text-right">{purchaseSummary.packageName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Course Type</dt><dd>{purchaseSummary.coursePackageType}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Method</dt><dd>{purchaseSummary.paymentMethod}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Amount Paid</dt><dd>HKD {purchaseSummary.amountPaid}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">First Lesson</dt><dd className="text-right">{purchaseSummary.firstSessionHint}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink/60">Remaining Balance</dt><dd>{purchaseSummary.remainingBalance ?? "—"} 堂</dd></div>
            </dl>
            <Link
              href="/admin/course-set"
              className="block w-full rounded-md bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
            >
              Arrange Course & Generate PIN / 安排課程並產生 PIN
            </Link>
            <Link
              href="/admin"
              className="block w-full rounded-md border border-purple-300 bg-canvas px-4 py-3 text-center text-sm font-semibold text-ink shadow-sm hover:bg-surface"
            >
              Back to Home / 返回主頁
            </Link>
            <button
              type="button"
              className="w-full rounded-md border border-ink/15 bg-canvas px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-surface"
              onClick={() => setPurchaseSummary(null)}
            >
              留在此頁
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
