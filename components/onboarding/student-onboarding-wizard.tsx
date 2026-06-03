"use client";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: Multi-step wizard shell and step 1 (identity / emergency contacts).
 * Logic: RHF + Zod; `/api/members/duplicate-check` before PAR-Q; quickName prefill.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import SignatureCanvas from "react-signature-canvas";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  onboardingStep1Schema,
  parqAnyYes,
  parqQuestionsSchema,
  studentRegistrationPayloadSchema,
  type StudentRegistrationPayload
} from "../../lib/schemas/student";
import { alertApiError, api } from "../../lib/api";

/**
 * [F001][S002]
 * Feature: Student Onboarding
 * Step: PAR-Q question labels (seven items; RHF keys under `parq`).
 * Logic: Checkbox copy only; defaults in `defaultParq`.
 */
const PARQ_LABELS: { key: keyof StudentRegistrationPayload["parq"]; label: string }[] = [
  { key: "q1_heart_condition", label: "醫生曾說你有心臟問題，只宜於醫生建議下運動？" },
  { key: "q2_chest_pain_activity", label: "你是否於進行體能活動時胸會痛？" },
  { key: "q3_chest_pain_rest", label: "過去一個月，你是否於休息時亦會胸會痛？" },
  { key: "q4_dizziness", label: "你是否曾於運動後感到暈眩？" },
  { key: "q5_bone_joint_problem", label: "骨骼或關節問題會否因運動而惡化？" },
  { key: "q6_blood_pressure_meds", label: "你是否正在服用血壓或心臟藥物？" },
  { key: "q7_other_reason", label: "是否有其他醫生未建議運動的原因？" }
];

/**
 * [F001][S002]
 * Feature: Student Onboarding
 * Step: PAR-Q default answers (all “否”) before user interaction.
 * Logic: Merged into `defaults.parq` for RHF.
 */
const defaultParq: StudentRegistrationPayload["parq"] = {
  q1_heart_condition: false,
  q2_chest_pain_activity: false,
  q3_chest_pain_rest: false,
  q4_dizziness: false,
  q5_bone_joint_problem: false,
  q6_blood_pressure_meds: false,
  q7_other_reason: false
};

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: Shared Tailwind class for step 1 & 3 text fields.
 * Logic: Single token string to keep inputs visually consistent.
 */
const fieldClass =
  "w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink/45 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: RHF `defaultValues` seed for entire wizard payload.
 * Logic: `full_name` overridden by `quickName` prop when present.
 */
const defaults: Partial<StudentRegistrationPayload> = {
  full_name: "",
  hkid: "",
  phone: "",
  email: "",
  date_of_birth: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  form_type: "new",
  parq: defaultParq,
  cooling_off_acknowledged: false,
  disclaimer_accepted: false,
  digital_signature: "",
  renewal_notes: "",
  medical_clearance_file_name: ""
};

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: Wizard component — wires steps 1–3, duplicate toast, success modal.
 * Logic: Client-only navigation between steps; server calls in `goNext` / `onFinalSubmit`.
 */
export default function StudentOnboardingWizard({ quickName }: { quickName?: string }) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [dupToastMsg, setDupToastMsg] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const parqFileRef = useRef<HTMLInputElement | null>(null);
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const router = useRouter();
  const [parqUploadError, setParqUploadError] = useState("");

  /**
   * [F001][S001]
   * Feature: Student Onboarding
   * Step: React Hook Form + Zod resolver for final submit validation.
   * Logic: `studentRegistrationPayloadSchema` enforces step 3 attestations and PAR-Q file rule.
   */
  const form = useForm<StudentRegistrationPayload>({
    resolver: zodResolver(studentRegistrationPayloadSchema),
    defaultValues: { ...defaults, full_name: quickName ?? "" } as StudentRegistrationPayload,
    mode: "onBlur"
  });

  /**
   * [F001][S002]
   * Feature: Student Onboarding
   * Step: PAR-Q reactive state — drives medical upload visibility and step-2 “下一步” enablement.
   * Logic: `step2NextEnabled` when no “yes” OR (filename set and no client upload error).
   */
  const parqWatch = form.watch("parq");
  const clearanceNameWatch = form.watch("medical_clearance_file_name");
  const anyParqYesVal = parqAnyYes(parqWatch);
  const step2NextEnabled =
    !anyParqYesVal || (String(clearanceNameWatch || "").trim().length > 0 && !parqUploadError);

  /**
   * [F001][S002]
   * Feature: Student Onboarding
   * Step: Reset medical clearance when user clears all PAR-Q “是” answers.
   * Logic: Clears RHF field, error text, and native file input.
   */
  useEffect(() => {
    if (!anyParqYesVal) {
      form.setValue("medical_clearance_file_name", "");
      setParqUploadError("");
      if (parqFileRef.current) parqFileRef.current.value = "";
    }
  }, [anyParqYesVal, form]);
  /**
   * [F001][S001]
   * Feature: Student Onboarding
   * Step: `quickName` query / prop sync into `full_name`.
   * Logic: Used by `/student/onboard?quickName=…` shortcut.
   */
  useEffect(() => {
    if (quickName) form.setValue("full_name", quickName);
  }, [quickName, form]);

  /**
   * [F001][S001]
   * Feature: Student Onboarding
   * Step: Duplicate-member toast lifecycle.
   * Logic: Auto-hide after 6.5s so user can retry step 1.
   */
  useEffect(() => {
    if (!dupToastMsg) return;
    const t = window.setTimeout(() => setDupToastMsg(null), 6500);
    return () => window.clearTimeout(t);
  }, [dupToastMsg]);

  /**
   * [F001][S002]
   * Feature: Student Onboarding
   * Step: Medical clearance file — PDF or image, max 3MB; stores filename for API `medical_clearance_file_name`.
   */
  function onParqClearanceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    form.clearErrors("medical_clearance_file_name");
    setParqUploadError("");
    if (!file) {
      form.setValue("medical_clearance_file_name", "");
      return;
    }
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setParqUploadError("檔案不可超過 3MB");
      input.value = "";
      form.setValue("medical_clearance_file_name", "");
      return;
    }
    const okType = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      setParqUploadError("請上傳 PDF 或圖片（JPEG、PNG、WebP、GIF）");
      input.value = "";
      form.setValue("medical_clearance_file_name", "");
      return;
    }
    form.setValue("medical_clearance_file_name", file.name);
  }

  /**
   * [F001][S001]
   * Feature: Student Onboarding
   * Step: Step advance — validate step 1 (dup check), step 2 (PAR-Q + upload gate), then step 3.
   */
  async function goNext() {
    setStatus("");
    if (step === 1) {
      setDupToastMsg(null);
      form.clearErrors([
        "full_name",
        "hkid",
        "phone",
        "email",
        "date_of_birth",
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
        date_of_birth: vals.date_of_birth,
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
            "date_of_birth",
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
      if (parqAnyYes(parqVals)) {
        const fn = (form.getValues("medical_clearance_file_name") || "").trim();
        if (!fn) {
          form.setError("medical_clearance_file_name", {
            message: "請上傳醫生證明（PDF 或圖片，上限 3MB）"
          });
          return;
        }
      }
      form.clearErrors("parq");
      form.clearErrors("medical_clearance_file_name");
      setStep(3);
      return;
    }
  }

  /**
   * [F001][S004]
   * Feature: Student Onboarding
   * Step: Final submit — `POST /api/members`; sessionStorage context + success dialog.
   */
  async function onFinalSubmit(values: StudentRegistrationPayload) {
    const signatureData = signatureRef.current?.isEmpty()
      ? ""
      : signatureRef.current?.getTrimmedCanvas().toDataURL("image/png") ?? "";
    if (!signatureData) {
      form.setError("digital_signature", { message: "請在簽名框手寫簽署" });
      return;
    }
    setStatus("提交中…");
    setShowSuccessDialog(false);
    try {
      const res = (await api.createMember({
        full_name: values.full_name,
        hkid: values.hkid,
        phone: values.phone,
        email: values.email,
        date_of_birth: values.date_of_birth,
        emergency_contact_name: values.emergency_contact_name,
        emergency_contact_phone: values.emergency_contact_phone,
        parq: values.parq,
        medical_clearance_file_name: (values.medical_clearance_file_name || "").trim(),
        cooling_off_acknowledged: values.cooling_off_acknowledged,
        disclaimer_accepted: values.disclaimer_accepted,
        digital_signature: signatureData
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
      {/* [F001][S001] Page chrome — title + step indicator */}
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

      {/* [F001][S001] Duplicate member pre-check feedback (API `memberDuplicateCheck`) */}
      {dupToastMsg ? (
        <div
          className="fixed left-4 right-4 top-4 z-[140] mx-auto max-w-lg rounded-xl border border-amber-300/90 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-lg ring-1 ring-amber-500/30"
          role="alert"
        >
          {dupToastMsg}
        </div>
      ) : null}

      {/* [F001][S001–S004] Wizard form — one RHF form; step-specific field groups above footer actions */}
      <form
        ref={formRef}
        className="space-y-5 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]"
        onSubmit={form.handleSubmit(onFinalSubmit)}
      >
        {/* [F001][S001] Step 1 — personal + emergency + HK phones as +852 eight digits */}
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
                maxLength={4}
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
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">出生日期 Date of Birth *</span>
              <input
                className={fieldClass}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                {...form.register("date_of_birth")}
              />
            </label>
            {form.formState.errors.date_of_birth && (
              <p className="text-xs text-rose-400">{form.formState.errors.date_of_birth.message}</p>
            )}
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

        {/* [F001][S002] Step 2 — PAR-Q checkboxes + conditional medical file (≤3MB) */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-ink/80">
              PAR-Q：請如實勾選；任一項答「是」須上傳醫生證明（PDF 或圖片，<strong>上限 3MB</strong>
              ），上傳成功後方可按「下一步」。
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
            {anyParqYesVal ? (
              <div className="space-y-2 rounded-lg border border-ink/10 bg-canvas/90 p-3">
                <p className="text-xs font-medium text-ink">醫療／醫生證明上傳（必填）</p>
                <input
                  ref={parqFileRef}
                  data-testid="parq-medical-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="block w-full text-xs text-ink/80 file:mr-3 file:rounded-md file:border file:border-ink/15 file:bg-primary/90 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
                  onChange={onParqClearanceFileChange}
                />
                {parqUploadError ? (
                  <p className="text-xs text-rose-600">{parqUploadError}</p>
                ) : null}
                {clearanceNameWatch && !parqUploadError ? (
                  <p className="text-xs font-medium text-emerald-800">已接收檔案：{clearanceNameWatch}</p>
                ) : null}
                {form.formState.errors.medical_clearance_file_name ? (
                  <p className="text-xs text-rose-600">
                    {String(form.formState.errors.medical_clearance_file_name.message)}
                  </p>
                ) : null}
              </div>
            ) : null}
            {form.formState.errors.parq && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.parq.message)}</p>
            )}
          </div>
        )}

        {/* [F001][S004] Step 3 — cooling-off + disclaimer + e-signature + optional renewal notes */}
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
  className="relative flex items-start touch-manipulation gap-3 rounded-lg border border-ink/[0.08] bg-canvas p-3 text-sm text-ink cursor-pointer"
>
  <input
    type="checkbox"
    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary" 
    {...form.register("cooling_off_acknowledged")}
  />
  <p className="text-xs leading-relaxed text-ink/85">
    本人確認已閱讀並理解冷靜期條款。
  </p>
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
            
              <div>

              <label
              data-disclaimer-ack
      className="relative flex items-start touch-manipulation gap-3 rounded-lg border border-ink/[0.08] bg-canvas p-3 text-sm text-ink cursor-pointer"
            >
              <input
                type="checkbox"
    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary" 
                {...form.register("disclaimer_accepted")}
              />
  <p className="text-xs leading-relaxed text-ink/85">
                本人已閱讀並同意健康聲明及免責條款。
             </p>
            </label>
              </div>
            
            {form.formState.errors.disclaimer_accepted && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.disclaimer_accepted.message)}</p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">電子簽署 Signature *</p>
                <button
                  type="button"
                  className="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
                  onClick={() => {
                    signatureRef.current?.clear();
                    form.setValue("digital_signature", "");
                  }}
                >
                  清除
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-ink/15 bg-white shadow-inner">
                <SignatureCanvas
                  ref={signatureRef}
                  penColor="#2d2422"
                  canvasProps={{
                    className: "h-40 w-full touch-none",
                    "aria-label": "電子簽署手寫區"
                  }}
                  onEnd={() => {
                    const data = signatureRef.current?.isEmpty()
                      ? ""
                      : signatureRef.current?.getTrimmedCanvas().toDataURL("image/png") ?? "";
                    form.setValue("digital_signature", data, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
              <p className="text-xs text-ink/55">請用手指或滑鼠簽署；系統只儲存簽名圖片 URL。</p>
            </div>
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

        {/* [F001][S001] Step navigation — `下一步` gated on step 2 upload when PAR-Q any-yes */}
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
              disabled={step === 2 && !step2NextEnabled}
              className="rounded-md border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* [F001][S004] Post-submit success — optional redirect to photo flow via session context */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-5 text-ink shadow-xl ring-1 ring-ink/[0.06]">
            <h2 className="text-lg font-semibold">申請成功</h2>
            <p className="text-sm text-ink/80"></p>
            <button
              type="button"
              className="w-full rounded-md border border-ink/15 bg-primary/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-primary"
              onClick={() => router.push("/")}
            >
              回到主頁
            </button>
          </div>
        </div>
      )}
      {status && <p className="text-sm text-ink/85">{status}</p>}
    </main>
  );
}
