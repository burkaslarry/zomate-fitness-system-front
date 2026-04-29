"use client";

/** @feature [F01.1][F01.2][F01.3][F01.4] */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  studentRegistrationPayloadSchema,
  type StudentRegistrationPayload,
  parqRequiresClearance,
  computeMembershipExpiryIso
} from "../../lib/schemas/student";
import { alertApiError, api } from "../../lib/api";
import { useDemoState } from "../../lib/demo-state";
import { useWhatsAppLog } from "../../hooks/use-whatsapp-log";

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
  "w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-white shadow-sm placeholder:text-zinc-500 [color-scheme:dark] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]";

const defaults: Partial<StudentRegistrationPayload> = {
  full_name: "",
  hkid: "",
  phone: "",
  email: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  form_type: "new",
  parq: defaultParq,
  medical_clearance_file_name: "",
  cooling_off_acknowledged: false,
  disclaimer_accepted: false,
  digital_signature: "",
  package_sessions: 10,
  renewal_notes: ""
};

export default function StudentOnboardingWizard({ quickName }: { quickName?: string }) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [assignedPin, setAssignedPin] = useState<string | null>(null);
  const [expiryPreview, setExpiryPreview] = useState<string>("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const { addStudent } = useDemoState();
  const { logOnboardingSuccess } = useWhatsAppLog();

  const form = useForm<StudentRegistrationPayload>({
    resolver: zodResolver(studentRegistrationPayloadSchema),
    defaultValues: { ...defaults, full_name: quickName ?? "" } as StudentRegistrationPayload,
    mode: "onBlur"
  });

  const pkg = form.watch("package_sessions");
  const parqWatch = form.watch("parq");

  useEffect(() => {
    const iso = computeMembershipExpiryIso(pkg === 30 ? 30 : 10, new Date());
    setExpiryPreview(new Date(iso).toLocaleDateString());
  }, [pkg]);

  useEffect(() => {
    if (quickName) form.setValue("full_name", quickName);
  }, [quickName, form]);

  const clearanceNeeded = parqRequiresClearance(parqWatch ?? defaultParq);

  async function goNext() {
    setStatus("");
    if (step === 1) {
      const ok = await form.trigger([
        "full_name",
        "hkid",
        "phone",
        "email",
        "emergency_contact_name",
        "emergency_contact_phone",
        "form_type"
      ]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const okParq = await form.trigger(["parq"]);
      if (!okParq) return;
      if (clearanceNeeded) {
        const name = form.getValues("medical_clearance_file_name");
        if (!name?.trim()) {
          setStatus("PAR-Q 任一為「是」時請上載醫生 clearance（選擇檔案後會記錄檔名）。");
          return;
        }
      }
      setStep(3);
      return;
    }
  }

  async function onFinalSubmit(values: StudentRegistrationPayload) {
    setStatus("提交中…");
    setAssignedPin(null);
    try {
      const res = (await api.studentsRegisterV1(values as unknown as Record<string, unknown>)) as {
        pin_code: string;
        membership_expiry_iso: string;
      };
      const pin = res.pin_code ?? "?";
      setAssignedPin(pin);
      addStudent({
        name: values.full_name,
        phone: values.phone,
        remainingCredits: values.package_sessions,
        pin,
        membershipType: "new",
        englishName: "",
        emergencyContactName: values.emergency_contact_name,
        emergencyContactPhone: values.emergency_contact_phone,
        coachName: "",
        plan: values.package_sessions === 30 ? "30" : "10",
        paymentMethod: "",
        notes: values.renewal_notes ?? ""
      });
      logOnboardingSuccess(values.full_name, values.phone, pin);
      setStatus(
        `登記成功！會籍到期（自動計算）：${new Date(res.membership_expiry_iso).toLocaleDateString()} · ${values.package_sessions} 堂方案對應 ${values.package_sessions === 10 ? "3" : "6"} 個月。`
      );
      form.reset({ ...defaults, full_name: "", hkid: "", phone: "" } as StudentRegistrationPayload);
      setStep(1);
    } catch (err) {
      setStatus("");
      alertApiError(err);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-6 bg-zinc-950 p-6 text-white">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-white">新人入會 · F01</h1>
        <Link href="/student" className="text-sm text-white/80 underline underline-offset-4 hover:text-white">
          返回
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-white/70">
        <li className={step >= 1 ? "font-medium text-emerald-400" : ""}>① 個人／緊急聯絡</li>
        <li className={step >= 2 ? "font-medium text-emerald-400" : ""}>② PAR-Q</li>
        <li className={step >= 3 ? "font-medium text-emerald-400" : ""}>③ 冷靜期／簽署</li>
      </ol>

      <form
        ref={formRef}
        className="space-y-5 rounded-xl border border-white/[0.12] bg-[#141414] p-5 shadow-sm"
        onSubmit={form.handleSubmit(onFinalSubmit)}
      >
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-white [text-wrap:pretty]">
              新人入會：掃描後台「登記 QR」填此表。簽到：掃「簽到 QR」→ 搜尋自己姓名 → 輸入 PIN 扣堂。
            </p>
            <input className={fieldClass} placeholder="姓名 *" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-xs text-rose-400">{form.formState.errors.full_name.message}</p>
            )}
            <input className={fieldClass} placeholder="HKID *（例：A1234567）" {...form.register("hkid")} />
            {form.formState.errors.hkid && (
              <p className="text-xs text-rose-400">{form.formState.errors.hkid.message}</p>
            )}
            <input className={fieldClass} placeholder="電話 * +852…" {...form.register("phone")} />
            {form.formState.errors.phone && (
              <p className="text-xs text-rose-400">{form.formState.errors.phone.message}</p>
            )}
            <input className={fieldClass} placeholder="電郵（可選）" {...form.register("email")} />
            <input className={fieldClass} placeholder="緊急聯絡人姓名 *" {...form.register("emergency_contact_name")} />
            <input className={fieldClass} placeholder="緊急聯絡人電話 *" {...form.register("emergency_contact_phone")} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-white/90">
              PAR-Q：請如實選「是／否」。任一題為「是」須上載醫生 clearance。
            </p>
            {PARQ_LABELS.map(({ key, label }) => (
              <Controller
                key={key}
                name={`parq.${key}`}
                control={form.control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.08] bg-[#121212] px-3 py-2 text-sm text-white">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[#6366f1]"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                )}
              />
            ))}
            {clearanceNeeded ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-100">請上載醫療／醫生 clearance</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="text-xs text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-[#6366f1] file:px-3 file:py-1.5 file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    form.setValue("medical_clearance_file_name", f?.name ?? "");
                  }}
                />
                {form.formState.errors.medical_clearance_file_name && (
                  <p className="text-xs text-rose-400">{form.formState.errors.medical_clearance_file_name.message}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/75">無需額外 clearance。</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div data-cooling-copy className="rounded-lg border border-white/[0.1] bg-[#121212] p-4 text-xs leading-relaxed text-white/85">
              <p className="font-semibold text-white">7 天冷靜期</p>
              <p className="mt-2">
                會員可在簽署後 7 個曆日內書面通知中心終止合約（扣除合理行政費用之條款以實際合約為準）
              </p>
            </div>
            <label
              data-cooling-ack
              className="flex w-full max-w-full touch-manipulation items-start gap-3 text-sm text-white"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-6 w-6 min-h-[1.5rem] min-w-[1.5rem] shrink-0 cursor-pointer accent-[#6366f1]"
                {...form.register("cooling_off_acknowledged")}
              />
              <span className="min-w-0 flex-1 text-left leading-snug [word-break:normal]">
                本人確認已閱讀並理解冷靜期條款。
              </span>
            </label>
            {form.formState.errors.cooling_off_acknowledged && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.cooling_off_acknowledged.message)}</p>
            )}
            <div className="rounded-lg border border-white/[0.1] bg-[#121212] p-4 text-xs leading-relaxed text-white/85">
              <p className="font-semibold text-white">免責聲明</p>
              <p className="mt-2">
                參加本中心訓練前，請確認已理解運動風險；如有長期病患請先諮詢醫生
              </p>
            </div>
            <label
              data-disclaimer-ack
              className="flex w-full max-w-full touch-manipulation items-start gap-3 text-sm text-white"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-6 w-6 min-h-[1.5rem] min-w-[1.5rem] shrink-0 cursor-pointer accent-[#6366f1]"
                {...form.register("disclaimer_accepted")}
              />
              <span className="min-w-0 flex-1 text-left leading-snug [word-break:normal]">
                本人已閱讀並同意健康聲明及免責條款。
              </span>
            </label>
            {form.formState.errors.disclaimer_accepted && (
              <p className="text-xs text-rose-400">{String(form.formState.errors.disclaimer_accepted.message)}</p>
            )}
            <div>
              <label className="text-xs text-white/80">方案</label>
              <select
                className={`${fieldClass} mt-1 [&>option]:bg-[#1a1a1a]`}
                {...form.register("package_sessions", { valueAsNumber: true })}
              >
                <option value={10}>10 堂（有效期 3 個月 · 預覽到期 {expiryPreview}）</option>
                <option value={30}>30 堂（有效期 6 個月 · 預覽到期 {expiryPreview}）</option>
              </select>
            </div>
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

        <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
          {step > 1 && (
            <button
              type="button"
              className="rounded-md border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-100"
              onClick={() => setStep((s) => s - 1)}
            >
              上一步
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#535bf0]"
              onClick={() => void goNext()}
            >
              下一步
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#535bf0]"
            >
              提交登記
            </button>
          )}
        </div>
      </form>

      {assignedPin && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          簽到 PIN：<span className="font-mono text-lg">{assignedPin}</span>
        </p>
      )}
      {status && <p className="text-sm text-white/90">{status}</p>}
    </main>
  );
}
