"use client";

/**
 * [F002][S003]
 * Feature: Course Entry & Automation
 * Step: Shared reg-course — record payment; PIN via 開課頁 / check-in gating
 * Logic: One-click confirm; full pay vs installment checkboxes; receipt optional.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { alertApiError, api } from "../lib/api";
import type { CoachDto, CourseCategoryDto, InstallmentSegmentPinDto, MemberProfile } from "../types/api";
import FileUpload from "./forms/file-upload";
import PaymentMethodRadio from "./forms/payment-method-radio";

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

function displayHongKongPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("852")) return d.slice(3);
  if (d.length === 8) return d;
  return raw.trim();
}

function isValidRenewalAmount(raw: string): boolean {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

function digitsOnlyLessons(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2);
}

function pythonWeekdayFromDate(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function buildAutoCoursePayload(opts: {
  title: string;
  branchId: number;
  coachId: number;
  studentId: number;
  totalLessons: number;
  totalInstallments: number;
  remarks?: string;
}) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(11, 0, 0, 0);
  return {
    title: opts.title,
    branch_id: opts.branchId,
    coach_id: opts.coachId,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    student_ids: [opts.studentId],
    course_start_date: now.toISOString().slice(0, 10),
    lesson_weekdays: [pythonWeekdayFromDate(now)],
    total_lessons: opts.totalLessons,
    total_installments: opts.totalInstallments,
    coach_schedule_note: opts.remarks?.trim() || undefined
  };
}

const NEW_STUDENT_CATEGORY_PREFIX = "新學生";

type PurchaseSummary = {
  studentId: number;
  studentName: string;
  packageName: string;
  coursePackageType: string;
  amountPaid: string;
  remainingBalance: number | null;
  paymentMethod: string;
  coachName: string;
  totalInstallments: number;
  checkinPin: string;
  installmentSegments: InstallmentSegmentPinDto[];
  enrollmentId: number | null;
};

type WizardStep = 0 | 1 | 2 | 3;

export type RegCourseWizardProps = {
  mode: "staff" | "coach";
  lockedCoachId?: number;
  lockedCoachName?: string;
  lockedBranchId?: number | null;
  homeHref?: string;
};

export default function RegCourseWizard({
  mode,
  lockedCoachId,
  lockedCoachName,
  lockedBranchId,
  homeHref = mode === "coach" ? "/coach-portal" : "/admin"
}: RegCourseWizardProps) {
  const [phone, setPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [step, setStep] = useState<WizardStep>(0);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [coachId, setCoachId] = useState<number | "">(lockedCoachId ?? "");
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [lessonsText, setLessonsText] = useState("10");
  const [amount, setAmount] = useState("");
  const [lookupHint, setLookupHint] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary | null>(null);
  const [defaultBranchId, setDefaultBranchId] = useState<number | null>(lockedBranchId ?? null);
  const [fullPay, setFullPay] = useState(true);
  const [installmentPay, setInstallmentPay] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<2 | 3>(2);
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seededPhone = params.get("student");
    if (seededPhone) setPhone(seededPhone);
  }, []);

  useEffect(() => {
    if (mode === "coach" && lockedCoachId) {
      setCoachId(lockedCoachId);
      return;
    }
    void api.publicCoaches().then((rows) => {
      setCoaches(Array.isArray(rows) ? (rows as CoachDto[]) : []);
    });
  }, [mode, lockedCoachId]);

  useEffect(() => {
    if (defaultBranchId != null) return;
    void api.publicBranches().then((rows) => {
      const list = Array.isArray(rows) ? (rows as { id: number }[]) : [];
      if (list[0]?.id) setDefaultBranchId(list[0].id);
    });
  }, [defaultBranchId]);

  const selectedCoach = useMemo(() => {
    if (mode === "coach" && lockedCoachId) {
      return { id: lockedCoachId, full_name: lockedCoachName ?? "教練", branch_id: lockedBranchId ?? null } as CoachDto;
    }
    return coaches.find((c) => c.id === coachId) ?? null;
  }, [mode, lockedCoachId, lockedCoachName, lockedBranchId, coaches, coachId]);

  const filteredCategories = useMemo(() => {
    if (!member) return [];
    const hasPaidBefore = member.lesson_balance > 0 || member.current_course_package_status !== "No active package";
    return categories.filter((kind) => {
      if (kind.is_active === false) return false;
      if (hasPaidBefore && kind.name.startsWith(NEW_STUDENT_CATEGORY_PREFIX)) return false;
      return true;
    });
  }, [categories, member]);

  const totalInstallments = installmentPay ? installmentCount : 1;

  function selectFullPay() {
    setFullPay(true);
    setInstallmentPay(false);
  }

  function selectInstallmentPay() {
    setFullPay(false);
    setInstallmentPay(true);
  }

  async function lookup() {
    const q = inputToLookupPhone(phone);
    const digits = q.replace(/\D/g, "");
    if (digits.length < 8) {
      setLookupHint("請輸入香港 8 位手機號碼。");
      return;
    }
    setLookupBusy(true);
    setLookupHint("");
    try {
      const row = (await api.memberLookupByPhone(q)) as MemberProfile;
      setMember(row);
      setStep(mode === "coach" ? 2 : 1);
      if (mode !== "coach") setCoachId(row.onboarding_coach_id ?? lockedCoachId ?? "");
      setCategoryId("");
      setLessonsText("10");
      setAmount("");
      selectFullPay();
      setInstallmentCount(2);
      setRemarks("");
      setPurchaseSummary(null);
    } catch (err) {
      setMember(null);
      setStep(0);
      alertApiError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  useEffect(() => {
    const cid = typeof coachId === "number" ? coachId : lockedCoachId;
    if (!cid) {
      setCategories([]);
      return;
    }
    void api.publicCourseCategories(cid).then((rows) => {
      const list = Array.isArray(rows) ? (rows as CourseCategoryDto[]) : [];
      setCategories(list);
      setCategoryId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    });
  }, [coachId, lockedCoachId]);

  function goCoachNext() {
    if (!coachId) {
      alertApiError(new Error("請選擇負責教練"));
      return;
    }
    setStep(2);
  }

  function goCategoryNext() {
    const lessons = Number(lessonsText);
    if (!categoryId) {
      alertApiError(new Error("請選擇課堂種類"));
      return;
    }
    if (!Number.isFinite(lessons) || lessons < 10 || lessons > 30) {
      alertApiError(new Error("堂數須為 10–30 的整數"));
      return;
    }
    setStep(3);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !coachId || !categoryId) return;
    const selectedKind = filteredCategories.find((k) => k.id === categoryId);
    if (!selectedKind) return;
    if (!isValidRenewalAmount(amount)) {
      alertApiError(new Error("請輸入有效應付金額"));
      return;
    }
    const form = new FormData(event.currentTarget);
    const method = String(form.get("payment_method") ?? "").trim();
    if (!method) {
      alertApiError(new Error("請選擇付款方式"));
      return;
    }
    const lessons = Number(lessonsText);
    const branchId = selectedCoach?.branch_id ?? defaultBranchId;
    if (!branchId) {
      alertApiError(new Error("找不到分店，請先在後台設定教練分店。"));
      return;
    }
    const receipt = form.get("receipt");
    const noteParts = [`[${selectedKind.name}] 教練 ${selectedCoach?.full_name ?? coachId}`];
    if (remarks.trim()) noteParts.push(remarks.trim());
    if (installmentPay) noteParts.push(`分期 ${totalInstallments} 期`);
    else noteParts.push("一次付清");
    try {
      setRenewalSubmitting(true);
      await api.createRenewal({
        student_id: member.id,
        total_lessons: lessons,
        coach_id: Number(coachId),
        branch_id: branchId,
        amount: amount.trim().replace(/,/g, ""),
        payment_method: method,
        transaction_type: selectedKind.name.startsWith(NEW_STUDENT_CATEGORY_PREFIX) ? "new_package" : "renewal",
        course_package_type_code: `cat_${selectedKind.id}`,
        course_package_type_label: selectedKind.name,
        note: noteParts.join(" · "),
        receipt: receipt instanceof File && receipt.name ? receipt : null,
        skip_lesson_ledger: true
      });
      const coursePayload = buildAutoCoursePayload({
        title: selectedKind.name,
        branchId,
        coachId: Number(coachId),
        studentId: member.id,
        totalLessons: lessons,
        totalInstallments,
        remarks
      });
      const courseRes = (await (mode === "coach"
        ? api.coachRegisterCourse(coursePayload)
        : api.createCourse(coursePayload))) as {
        id: number;
        enrollments?: Array<{
          checkin_pin?: string;
          installment_segments?: InstallmentSegmentPinDto[];
        }>;
      };
      const enr = courseRes.enrollments?.[0];
      const balanceRes = (await api.memberLookupByPhone(member.phone)) as MemberProfile;
      setPurchaseSummary({
        studentId: member.id,
        studentName: member.full_name,
        packageName: `${lessons} 堂`,
        coursePackageType: selectedKind.name,
        amountPaid: amount.trim().replace(/,/g, ""),
        remainingBalance: balanceRes.lesson_balance,
        paymentMethod: method,
        coachName: selectedCoach?.full_name ?? "—",
        totalInstallments,
        checkinPin: enr?.checkin_pin ?? "—",
        installmentSegments: enr?.installment_segments ?? [],
        enrollmentId: courseRes.id ?? null
      });
    } catch (err) {
      alertApiError(err);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  const stepLabels =
    mode === "coach"
      ? ["查找學員", "課堂種類 · 堂數", "確認付款"]
      : ["查找學員", "負責教練", "課堂種類 · 堂數", "確認付款"];

  const displayStep = mode === "coach" && step >= 2 ? step - 1 : step;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-5">
      <p className="text-sm text-ink/65">
        {mode === "coach"
          ? "記錄付款並產生簽到 PIN（頁內顯示，唔彈窗）。分期：第 2／3 期未付時簽到頁會提示。"
          : "確認付款後即時開課並顯示 PIN；學生詳情「已開課程」亦會見到。分期第 2／3 期須收款後才可簽到。"}
      </p>

      <ol className="flex flex-wrap gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
        {stepLabels.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-2.5 py-1 sm:px-3 ${
              displayStep === i
                ? "bg-primary/90 font-semibold text-black"
                : displayStep > i
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-ink/5 text-ink/45"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-sm text-ink/65">以電話查找學員（8 位香港手機）</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="91234567"
              inputMode="tel"
              className="flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-base sm:text-sm"
              autoComplete="tel"
            />
            <button
              type="button"
              disabled={lookupBusy}
              onClick={() => void lookup()}
              className="rounded-md bg-primary/90 px-4 py-2.5 text-sm font-medium text-black disabled:opacity-60"
            >
              {lookupBusy ? "…" : "搜尋"}
            </button>
          </div>
          {lookupHint ? <p className="mt-2 text-sm text-amber-800">{lookupHint}</p> : null}
        </section>
      )}

      {member && step >= (mode === "coach" ? 2 : 1) && !purchaseSummary && (
        <p className="rounded-lg border border-ink/10 bg-surface px-3 py-2 text-sm">
          學員：<strong>{member.full_name}</strong> · {displayHongKongPhone(member.phone)}
          {mode === "coach" && lockedCoachName ? (
            <span className="mt-1 block text-xs text-ink/55 sm:ml-2 sm:mt-0 sm:inline">教練：{lockedCoachName}</span>
          ) : null}
        </p>
      )}

      {member && step === 1 && mode !== "coach" && (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold">Step 1 · 負責教練</h2>
          <select
            value={coachId === "" ? "" : String(coachId)}
            onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-base sm:text-sm"
          >
            <option value="">請選擇教練</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={goCoachNext}
            className="w-full rounded-md bg-primary/90 px-4 py-3 text-sm font-semibold text-black"
          >
            下一步
          </button>
        </section>
      )}

      {member && step === 2 && !purchaseSummary && (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold">
            {mode === "coach" ? "Step 1" : "Step 2"} · 課堂種類 · 堂數
          </h2>
          <select
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-base sm:text-sm"
          >
            <option value="">請選擇</option>
            {filteredCategories.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <label className="block text-sm">
            <span className="text-ink/70">堂數（10–30）</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={lessonsText}
              onChange={(e) => setLessonsText(digitsOnlyLessons(e.target.value))}
              className="mt-1 w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-base sm:text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/70">備註（選填）</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm"
              placeholder="例如：學員約首堂時間、特殊安排…"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {mode !== "coach" ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-md border border-ink/15 px-4 py-2.5 text-sm"
              >
                上一步
              </button>
            ) : null}
            <button
              type="button"
              onClick={goCategoryNext}
              className="flex-1 rounded-md bg-primary/90 px-4 py-3 text-sm font-semibold text-black"
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {member && step === 3 && !purchaseSummary && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold">
            {mode === "coach" ? "Step 2" : "Step 3"} · 確認付款
          </h2>
          <p className="text-xs text-ink/55">
            {filteredCategories.find((c) => c.id === categoryId)?.name} · {lessonsText} 堂
          </p>

          <label className="block text-sm">
            <span className="text-ink/70">應付金額（HKD）</span>
            <input
              inputMode="decimal"
              required
              placeholder="HKD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-base sm:text-sm"
            />
          </label>

          <fieldset className="space-y-2 rounded-lg border border-ink/10 bg-canvas/50 p-3 text-sm">
            <legend className="px-1 text-ink/70">付款安排</legend>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={fullPay}
                onChange={() => selectFullPay()}
                className="h-4 w-4 rounded border-ink/20"
              />
              一次付清（Full pay）— 開課後出 PIN 俾學生簽到
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={installmentPay}
                onChange={() => selectInstallmentPay()}
                className="h-4 w-4 rounded border-ink/20"
              />
              分期付款（Installment）
            </label>
            {installmentPay ? (
              <div className="ml-6 flex flex-wrap gap-4 pt-1">
                {([2, 3] as const).map((n) => (
                  <label key={n} className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={installmentCount === n}
                      onChange={() => setInstallmentCount(n)}
                      className="h-4 w-4 rounded border-ink/20"
                    />
                    {n} 期
                  </label>
                ))}
                <p className="w-full text-xs text-amber-900/85">
                  第 1 期付款後可開課；第 2／3 期未付時簽到頁會提示學生先付款。
                </p>
              </div>
            ) : null}
          </fieldset>

          <PaymentMethodRadio />
          <FileUpload name="receipt" label="收據上傳（選填，可候補）" />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-md border border-ink/15 px-4 py-2.5 text-sm">
              上一步
            </button>
            <button
              type="submit"
              disabled={renewalSubmitting || !isValidRenewalAmount(amount)}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {renewalSubmitting ? "提交中…" : "確認報名"}
            </button>
          </div>
        </form>
      )}

      {purchaseSummary ? (
        <section className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-emerald-900">已記錄付款 · 簽到 PIN</h2>

          <div className="rounded-xl border-2 border-emerald-700/30 bg-white px-4 py-5 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/55">課堂 PIN</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-ink sm:text-4xl">
              {purchaseSummary.checkinPin}
            </p>
            {purchaseSummary.totalInstallments > 1 ? (
              <p className="mt-2 text-xs text-amber-900">
                分期 {purchaseSummary.totalInstallments} 期 — 第 1 期 PIN 可簽到；第 2／3 期須收款後由櫃台標記已付。
              </p>
            ) : (
              <p className="mt-2 text-xs text-emerald-800">一次付清 — 此 PIN 可立即用於簽到。</p>
            )}
          </div>

          {purchaseSummary.installmentSegments.length > 1 ? (
            <ul className="space-y-1.5 text-xs">
              {purchaseSummary.installmentSegments.map((seg) => (
                <li
                  key={seg.installment_no}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                    seg.paid ? "border-emerald-300 bg-white" : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <span>
                    第 {seg.installment_no} 期 · 第 {seg.lesson_from}–{seg.lesson_to} 堂
                  </span>
                  <span className="font-mono font-semibold text-ink">{seg.pin}</span>
                  <span className="text-[10px]">{seg.paid ? "可簽到" : "待付款"}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="grid gap-2 text-sm text-emerald-950">
            <div className="flex justify-between gap-2">
              <dt className="text-emerald-800/70">學員</dt>
              <dd className="font-medium">{purchaseSummary.studentName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-emerald-800/70">種類</dt>
              <dd>{purchaseSummary.coursePackageType}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-emerald-800/70">金額</dt>
              <dd>HKD {purchaseSummary.amountPaid}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-emerald-800/70">餘額</dt>
              <dd>{purchaseSummary.remainingBalance ?? "—"} 堂</dd>
            </div>
          </dl>

          {mode === "staff" ? (
            <Link
              href={`/admin/students/${purchaseSummary.studentId}`}
              className="block w-full rounded-md bg-ink px-4 py-3 text-center text-sm font-semibold text-white"
            >
              查看學生詳情（已開課程 · PIN）
            </Link>
          ) : null}
          {mode === "staff" ? (
            <Link
              href="/admin/course-set"
              className="block w-full rounded-md border border-ink/20 bg-white px-4 py-2.5 text-center text-sm font-medium text-ink"
            >
              調整開課時間（選填）
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setPurchaseSummary(null);
              setMember(null);
              setStep(0);
              setPhone("");
            }}
            className="block w-full rounded-md border border-emerald-600/40 bg-white px-4 py-3 text-center text-sm font-medium text-emerald-900"
          >
            完成 · 替另一位學員報名
          </button>
          <Link href={homeHref} className="block w-full rounded-md border border-ink/15 px-4 py-2.5 text-center text-sm text-ink/80">
            返回主頁
          </Link>
        </section>
      ) : null}
    </div>
  );
}
