"use client";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Onboarding wizard UI: PAR-Q, HKID, policy steps.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  onboardingStep1Schema,
  parqQuestionsSchema,
  studentRegistrationPayloadSchema,
  type StudentRegistrationPayload
} from "../../lib/schemas/student";
import { alertApiError, api } from "../../lib/api";

const PARQ_LABELS: { key: keyof StudentRegistrationPayload["parq"]; label: string }[] = [
  { key: "q1_heart_condition", label: "醫生曾說你有心臟問題，只宜於醫生建議下運動？" },
  { key: "q2_chest_pain_activity", label: "你是否於進行體能活動時胸會痛？" },
  { key: "q3_chest_pain_rest", label: "過去一個月，你是否於休息時亦會胸會痛？" },
  { key: "q4_dizziness", label: "你是否曾於運動後感到暈眩？" },
  { key: "q5_bone_joint_problem", label: "骨骼或關節問題會否因運動而惡化？" },
  { key: "q6_blood_pressure_meds", label: "你是否正在服用血壓或心臟藥物？" },
  { key: "q7_other_reason", label: "是否有其他醫生未建議運動的原因？" }
];

const defaultParq: StudentRegistrationPayload["parq"] = {
  q1_heart_condition: false,
  q2_chest_pain_activity: false,
  q3_chest_pain_rest: false,
  q4_dizziness: false,
  q5_bone_joint_problem: false,
  q6_blood_pressure_meds: false,
  q7_other_reason: false
};

const fieldClass =
  "w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink/45 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40";

const defaults: Partial<StudentRegistrationPayload> = {
  full_name: "",
  hkid: "",
  phone: "",
  email: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  form_type: "new",
  parq: defaultParq,
  cooling_off_acknowledged: false,
  disclaimer_accepted: false,
  digital_signature: "",
  renewal_notes: ""
};

export default function StudentOnboardingWizard({ quickName }: { quickName?: string }) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [dupToastMsg, setDupToastMsg] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();

  const form = useForm<StudentRegistrationPayload>({
    resolver: zodResolver(studentRegistrationPayloadSchema),
    defaultValues: { ...defaults, full_name: quickName ?? "" } as StudentRegistrationPayload,
    mode: "onBlur"
  });

  useEffect(() => {
    if (quickName) form.setValue("full_name", quickName);
  }, [quickName, form]);

  useEffect(() => {
    if (!dupToastMsg) return;
    const t = window.setTimeout(() => setDupToastMsg(null), 6500);
    return () => window.clearTimeout(t);
  }, [dupToastMsg]);

  async function goNext() {
    setStatus("");
    if (step === 1) {
      setDupToastMsg(null);
      form.clearErrors([
        "full_name",
        "hkid",
        "phone",
        "email",
        "emergency_contact_name",
        "emergency_contact_phone",
        "form_type"
      ]);
      const vals = form.getValues();
      const step1Payload = {
        full_name: vals.full_name.trim(),
        hkid: vals.hkid.trim(),
        phone: vals.phone.trim(),
        email: (vals.email ?? "").trim(),
        emergency_contact_name: vals.emergency_contact_name.trim(),
        emergency_contact_phone: vals.emergency_contact_phone.trim(),
        form_type: vals.form_type
      };
      const parsed = onboardingStep1Schema.safeParse(step1Payload);
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        (
          [
            "full_name",
            "hkid",
            "phone",
            "email",
            "emergency_contact_name",
            "emergency_contact_phone",
            "form_type"
          ] as const
        ).forEach((key) => {
          const msg = flat[key]?.[0];
          if (msg) form.setError(key, { message: msg });
        });
        return;
      }
      try {
        const res = (await api.memberDuplicateCheck({
          full_name: step1Payload.full_name,
          hkid: step1Payload.hkid,
          phone: step1Payload.phone
        })) as { blocked?: boolean; message?: string | null };
        if (res.blocked) {
          setDupToastMsg(res.message ?? "系統已有相同會員紀錄，請改用續會或聯絡櫃台。");
          return;
        }
        setStep(2);
      } catch (err) {
        alertApiError(err);
      }
      return;
    }
    if (step === 2) {
      const parqVals = form.getValues("parq");
      const parsed = parqQuestionsSchema.safeParse(parqVals);
      if (!parsed.success) {
        form.setError("parq", { message: "請完成 PAR-Q 問卷" });
        return;
      }
      form.clearErrors("parq");
      setStep(3);
      return;
    }
  }

  async function onFinalSubmit(values: StudentRegistrationPayload) {
    setStatus("提交中…");
    setShowSuccessDialog(false);
    try {
      const res = (await api.createMember({
        full_name: values.full_name,
        hkid: values.hkid,
        phone: values.phone,
        email: values.email,
        emergency_contact_name: values.emergency_contact_name,
        emergency_contact_phone: values.emergency_contact_phone,
        parq: values.parq,
        cooling_off_acknowledged: values.cooling_off_acknowledged,
        disclaimer_accepted: values.disclaimer_accepted,
        digital_signature: values.digital_signature
      })) as {
        member?: { hkid?: string; full_name?: string };
      };
      const createdHkid = res.member?.hkid ?? values.hkid;
      const createdName = res.member?.full_name ?? values.full_name;
      window.sessionStorage.setItem(
        "zomate_register_context",
        JSON.stringify({ hkid: createdHkid, full_name: createdName })
      );
      setStatus("申請成功。");
      setShowSuccessDialog(true);
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-6 bg-canvas p-6 text-ink">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink">新人入會 · F01</h1>
        <Link href="/student" className="text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
          返回
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-ink/65">
        <li className={step >= 1 ? "font-medium text-primary" : ""}>① 個人／緊急聯絡</li>
        <li className={step >= 2 ? "font-medium text-primary" : ""}>② PAR-Q</li>
        <li className={step >= 3 ? "font-medium text-primary" : ""}>③ 冷靜期／簽署</li>
      </ol>

      {dupToastMsg ? (
        <div
          className="fixed left-4 right-4 top-4 z-[140] mx-auto max-w-lg rounded-xl border border-amber-300/90 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-lg ring-1 ring-amber-500/30"
          role="alert"
        >
          {dupToastMsg}
        </div>
      ) : null}

      <form
        ref={formRef}
        className="space-y-5 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]"
        onSubmit={form.handleSubmit(onFinalSubmit)}
      >
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink [text-wrap:pretty]">
              新人入會：掃描後台「登記 QR」填此表。簽到：掃「簽到 QR」→ 搜尋自己姓名 → 輸入 PIN 扣堂。
            </p>
            <input className={fieldClass} placeholder="姓名 *" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-xs text-rose-400">{form.formState.errors.full_name.message}</p>
            )}
            <div>
              <input
                className={fieldClass}
                placeholder="證件號碼／HKID（簡填 · 例：英文字 + 頭幾個數字 · A123）"
                autoCapitalize="characters"
                {...form.register("hkid")}
              />
              <p className="mt-1 text-[11px] leading-relaxed text-ink/50">
                F01：只需填寫字首英文 + 頭幾個數字（最少 4 字），唔使填足傳統身份證號碼。
              </p>
              {form.formState.errors.hkid && (
                <p className="text-xs text-rose-400">{form.formState.errors.hkid.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-ink/70">香港手機號碼 · 已固定 +852，只輸入八位數字</p>
              <div className="flex max-w-full items-stretch overflow-hidden rounded-lg border border-ink/15 bg-canvas shadow-sm ring-ink/10 focus-within:ring-2 focus-within:ring-primary/35">
                <span className="flex shrink-0 items-center border-r border-ink/10 bg-surface/80 px-3 text-sm font-semibold text-ink/80">
                  +852
                </span>
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field }) => {
                    const m = /^\+852(\d{0,8})$/.exec(field.value || "");
                    const digits = m?.[1] ?? "";
                    return (
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/35"
                        placeholder="12345678"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={8}
                        value={digits}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                          field.onChange(d.length > 0 ? `+852${d}` : "");
                        }}
                        onBlur={field.onBlur}
                      />
                    );
                  }}
                />
              </div>
              {form.formState.errors.phone && (
                <p className="text-xs text-rose-400">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <input className={fieldClass} placeholder="電郵（可選）" {...form.register("email")} />
            <input className={fieldClass} placeholder="緊急聯絡人姓名 *" {...form.register("emergency_contact_name")} />
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-ink/70">緊急聯絡人電話 · +852 八位數</p>
              <div className="flex max-w-full items-stretch overflow-hidden rounded-lg border border-ink/15 bg-canvas shadow-sm ring-ink/10 focus-within:ring-2 focus-within:ring-primary/35">
                <span className="flex shrink-0 items-center border-r border-ink/10 bg-surface/80 px-3 text-sm font-semibold text-ink/80">
                  +852
                </span>
                <Controller
                  name="emergency_contact_phone"
                  control={form.control}
                  render={({ field }) => {
                    const m = /^\+852(\d{0,8})$/.exec(field.value || "");
                    const digits = m?.[1] ?? "";
                    return (
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/35"
                        placeholder="87654321"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={8}
                        value={digits}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                          field.onChange(d.length > 0 ? `+852${d}` : "");
                        }}
                        onBlur={field.onBlur}
                      />
                    );
                  }}
                />
              </div>
              {form.formState.errors.emergency_contact_phone && (
                <p className="text-xs text-rose-400">{form.formState.errors.emergency_contact_phone.message}</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink/80">
              PAR-Q：請如實選「是／否」，此步驟只需完成問卷。
            </p>
            {PARQ_LABELS.map(({ key, label }) => (
              <Controller
                key={key}
                name={`parq.${key}`}
                control={form.control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink/[0.08] bg-canvas px-3 py-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                )}
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div data-cooling-copy className="rounded-lg border border-ink/10 bg-canvas p-4 text-xs leading-relaxed text-ink/85">
              <p className="font-semibold text-ink">7 天冷靜期</p>
              <p className="mt-2">
                會員可在簽署後 7 個曆日內書面通知中心終止合約（扣除合理行政費用之條款以實際合約為準）
              </p>
            </div>
            <label
              data-cooling-ack
              className="flex w-full touch-manipulation items-center gap-3 rounded-lg border border-ink/[0.08] bg-canvas p-3 text-sm text-ink"
            >
              <input
                type="checkbox"
                className="h-5 w-5 min-h-[1.25rem] min-w-[1.25rem] shrink-0 cursor-pointer accent-primary"
                {...form.register("cooling_off_acknowledged")}
              />
              <span className="min-w-0 text-left leading-6">
                本人確認已閱讀並理解冷靜期條款。
              </span>
            </label>
            {form.formState.errors.cooling_off_acknowledged && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.cooling_off_acknowledged.message)}</p>
            )}
            <div className="rounded-lg border border-ink/10 bg-canvas p-4 text-xs leading-relaxed text-ink/85">
              <p className="font-semibold text-ink">免責聲明</p>
              <p className="mt-2">
                參加本中心訓練前，請確認已理解運動風險；如有長期病患請先諮詢醫生
              </p>
            </div>
            <label
              data-disclaimer-ack
              className="flex w-full touch-manipulation items-center gap-3 rounded-lg border border-ink/[0.08] bg-canvas p-3 text-sm text-ink"
            >
              <input
                type="checkbox"
                className="h-5 w-5 min-h-[1.25rem] min-w-[1.25rem] shrink-0 cursor-pointer accent-primary"
                {...form.register("disclaimer_accepted")}
              />
              <span className="min-w-0 text-left leading-6">
                本人已閱讀並同意健康聲明及免責條款。
              </span>
            </label>
            {form.formState.errors.disclaimer_accepted && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.disclaimer_accepted.message)}</p>
            )}
            <input className={fieldClass} placeholder="電子簽署：輸入全名 *" {...form.register("digital_signature")} />
            {form.formState.errors.digital_signature && (
              <p className="text-xs text-rose-400">{form.formState.errors.digital_signature.message}</p>
            )}
            <textarea
              className={`${fieldClass} min-h-[4rem] resize-y`}
              placeholder="備註（可選）"
              rows={2}
              {...form.register("renewal_notes")}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-ink/[0.08] pt-4">
          {step > 1 && (
            <button
              type="button"
              className="rounded-md border border-ink/15 bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
              onClick={() => setStep((s) => s - 1)}
            >
              上一步
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="rounded-md border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary"
              onClick={() => void goNext()}
            >
              下一步
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-md border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary"
            >
              提交登記
            </button>
          )}
        </div>
      </form>

      {showSuccessDialog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-5 text-ink shadow-xl ring-1 ring-ink/[0.06]">
            <h2 className="text-lg font-semibold">申請成功</h2>
            <p className="text-sm text-ink/80">請立即上傳會員照片，完成新入會流程。</p>
            <button
              type="button"
              className="w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
              onClick={() => router.push("/register/photo")}
            >
              上傳照片
            </button>
          </div>
        </div>
      )}
      {status && <p className="text-sm text-ink/85">{status}</p>}
    </main>
  );
}
