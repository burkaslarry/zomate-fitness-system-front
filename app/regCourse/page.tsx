"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Sequential regCourse — coach → category+lessons → amount → payment (optional receipt)
 * Logic: Preload onboarding coach; category filtered by coach skills; receipt optional.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { alertApiError, api } from "../../lib/api";
import type { CoachDto, CourseCategoryDto, MemberProfile } from "../../types/api";
import FileUpload from "../../components/forms/file-upload";
import PaymentMethodRadio from "../../components/forms/payment-method-radio";

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

const NEW_STUDENT_CATEGORY_PREFIX = "新學生";

type PurchaseSummary = {
  studentName: string;
  packageName: string;
  coursePackageType: string;
  amountPaid: string;
  remainingBalance: number | null;
  paymentMethod: string;
  coachName: string;
};

type WizardStep = 0 | 1 | 2 | 3 | 4;

export default function RegCoursePage() {
  const [phone, setPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [step, setStep] = useState<WizardStep>(0);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [coachId, setCoachId] = useState<number | "">("");
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [lessonsText, setLessonsText] = useState("10");
  const [amount, setAmount] = useState("");
  const [lookupHint, setLookupHint] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary | null>(null);
  const [lastStudentId, setLastStudentId] = useState<number | null>(null);
  const [paymentWaLinks, setPaymentWaLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seededPhone = params.get("student");
    if (seededPhone) setPhone(seededPhone);
  }, []);

  useEffect(() => {
    void api.publicCoaches().then((rows) => {
      setCoaches(Array.isArray(rows) ? (rows as CoachDto[]) : []);
    });
  }, []);

  const selectedCoach = useMemo(
    () => coaches.find((c) => c.id === coachId) ?? null,
    [coaches, coachId]
  );

  const filteredCategories = useMemo(() => {
    if (!member) return [];
    const hasPaidBefore = member.lesson_balance > 0 || member.current_course_package_status !== "No active package";
    return categories.filter((kind) => {
      if (kind.is_active === false) return false;
      if (hasPaidBefore && kind.name.startsWith(NEW_STUDENT_CATEGORY_PREFIX)) return false;
      return true;
    });
  }, [categories, member]);

  async function lookup() {
    const q = inputToLookupPhone(phone);
    if (!q) {
      setLookupHint("請輸入電話號碼。");
      return;
    }
    setLookupBusy(true);
    setLookupHint("");
    try {
      const row = (await api.memberLookupByPhone(q)) as MemberProfile;
      setMember(row);
      setStep(1);
      setCoachId(row.onboarding_coach_id ?? "");
      setCategoryId("");
      setLessonsText("10");
      setAmount("");
    } catch (err) {
      setMember(null);
      setStep(0);
      alertApiError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  useEffect(() => {
    if (!coachId || typeof coachId !== "number") {
      setCategories([]);
      return;
    }
    void api.publicCourseCategories(coachId).then((rows) => {
      const list = Array.isArray(rows) ? (rows as CourseCategoryDto[]) : [];
      setCategories(list);
      setCategoryId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    });
  }, [coachId]);

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
    if (!Number.isFinite(lessons) || lessons < 1 || lessons > 30) {
      alertApiError(new Error("堂數須為 1–30 的整數"));
      return;
    }
    setStep(3);
  }

  function goAmountNext() {
    if (!isValidRenewalAmount(amount)) {
      alertApiError(new Error("請輸入有效應付金額"));
      return;
    }
    setStep(4);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !coachId || !categoryId) return;
    const selectedKind = filteredCategories.find((k) => k.id === categoryId);
    if (!selectedKind) return;
    const form = new FormData(event.currentTarget);
    const method = String(form.get("payment_method") ?? "").trim();
    if (!method) {
      alertApiError(new Error("請選擇付款方式"));
      return;
    }
    const lessons = Number(lessonsText);
    const receipt = form.get("receipt");
    try {
      setRenewalSubmitting(true);
      setPurchaseSummary(null);
      const payload: Parameters<typeof api.createRenewal>[0] = {
        student_id: member.id,
        total_lessons: lessons,
        coach_id: Number(coachId),
        amount: amount.trim().replace(/,/g, ""),
        payment_method: method,
        transaction_type: selectedKind.name.startsWith(NEW_STUDENT_CATEGORY_PREFIX) ? "new_package" : "renewal",
        course_package_type_code: `cat_${selectedKind.id}`,
        course_package_type_label: selectedKind.name,
        note: `[${selectedKind.name}] 教練 ${selectedCoach?.full_name ?? coachId}`,
        receipt: receipt instanceof File && receipt.name ? receipt : null
      };
      if (member.hkid) payload.member_hkid = member.hkid;
      const res = (await api.createRenewal(payload)) as { member?: { lesson_balance?: number } };
      if (member.id) setLastStudentId(member.id);
      setPurchaseSummary({
        studentName: member.full_name,
        packageName: `${lessons} 堂`,
        coursePackageType: selectedKind.name,
        amountPaid: amount.trim().replace(/,/g, ""),
        remainingBalance: typeof res.member?.lesson_balance === "number" ? res.member.lesson_balance : null,
        paymentMethod: method,
        coachName: selectedCoach?.full_name ?? "—"
      });
      setPaymentWaLinks([]);
    } catch (err) {
      alertApiError(err);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  async function sendPaymentReminderFromSummary() {
    if (!lastStudentId) return;
    setReminderBusy(true);
    try {
      const res = (await api.sendPaymentReminder(lastStudentId, {
        receipt_confirmed: Boolean(purchaseSummary?.amountPaid),
        notify_coach: true,
        amount: purchaseSummary?.amountPaid ? Number(purchaseSummary.amountPaid) : undefined
      })) as {
        whatsapp?: { student?: { wa_me_url?: string }; coach?: { wa_me_url?: string } };
      };
      const links: Array<{ label: string; url: string }> = [];
      if (res.whatsapp?.student?.wa_me_url) links.push({ label: "學生 WhatsApp", url: res.whatsapp.student.wa_me_url });
      if (res.whatsapp?.coach?.wa_me_url) links.push({ label: "教練 WhatsApp", url: res.whatsapp.coach.wa_me_url });
      setPaymentWaLinks(links);
    } catch (err) {
      alertApiError(err);
    } finally {
      setReminderBusy(false);
    }
  }

  const stepLabels = ["查找學員", "負責教練", "課堂種類 · 堂數", "應付金額", "付款方式"];

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-5 bg-canvas p-6 text-ink">
      <h1 className="text-2xl font-semibold">報 Course / 收費</h1>
      <p className="text-sm text-ink/65">
        依序：教練 → 課堂種類與堂數 → 金額 → 付款方式。收據可候補上傳。
      </p>

      <ol className="flex flex-wrap gap-2 text-xs">
        {stepLabels.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i ? "bg-primary/90 font-semibold text-ink" : step > i ? "bg-emerald-100 text-emerald-900" : "bg-ink/5 text-ink/45"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
          <p className="mb-3 text-sm text-ink/65">以電話查找學員（預設 +852）</p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="91234567"
              className="flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-2"
              autoComplete="tel"
            />
            <button
              type="button"
              disabled={lookupBusy}
              onClick={() => void lookup()}
              className="rounded-md bg-primary/90 px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              {lookupBusy ? "…" : "搜尋"}
            </button>
          </div>
          {lookupHint ? <p className="mt-2 text-sm text-amber-800">{lookupHint}</p> : null}
        </section>
      )}

      {member && step >= 1 && (
        <p className="rounded-lg border border-ink/10 bg-surface px-3 py-2 text-sm">
          學員：<strong>{member.full_name}</strong> · {displayHongKongPhone(member.phone)}
          {member.onboarding_coach_name ? (
            <span className="ml-2 text-xs text-ink/55">（入會教練：{member.onboarding_coach_name}）</span>
          ) : null}
        </p>
      )}

      {member && step === 1 && (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="text-sm font-semibold">Step 1 · 負責教練</h2>
          <select
            value={coachId === "" ? "" : String(coachId)}
            onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="">請選擇教練</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button type="button" onClick={goCoachNext} className="w-full rounded-md bg-primary/90 px-4 py-3 text-sm font-semibold text-ink">
            下一步
          </button>
        </section>
      )}

      {member && step === 2 && (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="text-sm font-semibold">Step 2 · 課堂種類 · 堂數</h2>
          <p className="text-xs text-ink/55">所屬教練可授的課堂種類</p>
          <select
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          >
            <option value="">請選擇</option>
            {filteredCategories.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <label className="block text-sm">
            <span className="text-ink/70">堂數（只允許數字）</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={lessonsText}
              onChange={(e) => setLessonsText(digitsOnlyLessons(e.target.value))}
              className="mt-1 w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm">
              上一步
            </button>
            <button type="button" onClick={goCategoryNext} className="flex-1 rounded-md bg-primary/90 px-4 py-3 text-sm font-semibold text-ink">
              下一步
            </button>
          </div>
        </section>
      )}

      {member && step === 3 && (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="text-sm font-semibold">Step 3 · 應付金額</h2>
          <input
            inputMode="decimal"
            placeholder="HKD"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm">
              上一步
            </button>
            <button
              type="button"
              disabled={!isValidRenewalAmount(amount)}
              onClick={goAmountNext}
              className="flex-1 rounded-md bg-primary/90 px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {member && step === 4 && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="text-sm font-semibold">Step 4 · 付款方式 · 收據（選填）</h2>
          <p className="text-xs text-ink/55">
            HKD {amount.replace(/,/g, "")} · {lessonsText} 堂 · {filteredCategories.find((c) => c.id === categoryId)?.name}
          </p>
          <PaymentMethodRadio />
          <FileUpload name="receipt" label="收據上傳（選填，可候補）" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm">
              上一步
            </button>
            <button
              type="submit"
              disabled={renewalSubmitting}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {renewalSubmitting ? "提交中…" : "確認報名"}
            </button>
          </div>
        </form>
      )}

      {purchaseSummary ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-purple-300 bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-purple-700">報名成功</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink/60">學員</dt><dd>{purchaseSummary.studentName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">教練</dt><dd>{purchaseSummary.coachName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">種類</dt><dd>{purchaseSummary.coursePackageType}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">堂數</dt><dd>{purchaseSummary.packageName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">金額</dt><dd>HKD {purchaseSummary.amountPaid}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">餘額</dt><dd>{purchaseSummary.remainingBalance ?? "—"} 堂</dd></div>
            </dl>
            {paymentWaLinks.length > 0 ? (
              <ul className="text-xs">
                {paymentWaLinks.map((l) => (
                  <li key={l.label}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="underline">{l.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={reminderBusy || !lastStudentId}
              onClick={() => void sendPaymentReminderFromSummary()}
              className="w-full rounded-md border px-4 py-2 text-sm"
            >
              {reminderBusy ? "…" : "WhatsApp 付款提醒"}
            </button>
            <Link href="/admin/course-set" className="block w-full rounded-md bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white">
              安排課程並產生 PIN
            </Link>
            <Link href="/admin" className="block w-full rounded-md border px-4 py-3 text-center text-sm">
              返回主頁
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
