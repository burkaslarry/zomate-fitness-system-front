/** @feature [F01.1][F01.2][F01.3][F01.4] */

import { z } from "zod";

/** F01 縮填：英文「證件字首」+ 頭幾個數字即可（最少 4 字；例：A123）。唔再強制標準 9 碼 HKID + 較驗字符。 */
export const hkidSchema = z
  .string()
  .trim()
  .min(4, "請至少輸入 4 個字元（例：英文字 + 頭幾個數字 · A123）")
  .max(12)
  .regex(/^[A-Z]{1,2}[0-9]+$/i, {
    message: "格式須為英文前置 + 數字（例如 A123）"
  });

/** 存入 API 嘅字串係 ``+852`` + **8** 位（表單只輸入 8 個數字）。 */
export const phoneHkSchema = z
  .string()
  .regex(/^\+852[0-9]{8}$/, { message: "請輸入香港手機號碼 8 位數字（自動帶 +852）" });

/** Standard PAR-Q — seven Yes/No questions. Any "Yes" → medical clearance required. */
export const parqQuestionsSchema = z.object({
  q1_heart_condition: z.boolean(),
  q2_chest_pain_activity: z.boolean(),
  q3_chest_pain_rest: z.boolean(),
  q4_dizziness: z.boolean(),
  q5_bone_joint_problem: z.boolean(),
  q6_blood_pressure_meds: z.boolean(),
  q7_other_reason: z.boolean()
});

export type ParqAnswers = z.infer<typeof parqQuestionsSchema>;

export function parqRequiresClearance(parq: ParqAnswers): boolean {
  return Object.values(parq).some(Boolean);
}

/** 10 sessions → 3 months; 30 sessions → 6 months from membership start. */
export function computeMembershipExpiryIso(packageSessions: 10 | 30, startDate: Date): string {
  const months = packageSessions === 10 ? 3 : 6;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export const onboardingStep1Schema = z.object({
  full_name: z.string().min(1, "請填寫姓名"),
  hkid: hkidSchema,
  phone: phoneHkSchema,
  email: z.union([z.literal(""), z.string().email()]),
  emergency_contact_name: z.string().min(1, "請填寫緊急聯絡人姓名"),
  emergency_contact_phone: phoneHkSchema,
  form_type: z.enum(["new", "renewal"])
});

export const onboardingStep3Schema = z.object({
  cooling_off_acknowledged: z.boolean().refine((v) => v === true, { message: "請確認已閱讀 7 天冷靜期條款" }),
  disclaimer_accepted: z.boolean().refine((v) => v === true, { message: "請同意免責聲明" }),
  digital_signature: z.string().min(2, "請輸入全名作電子簽署")
});

/** Full POST body after wizard steps — medical clearance filename set client-side when PAR-Q needs it. */
export const studentRegistrationPayloadSchema = z
  .object({
    full_name: z.string().min(1),
    hkid: hkidSchema,
    phone: phoneHkSchema,
    email: z.union([z.literal(""), z.string().email()]).optional(),
    emergency_contact_name: z.string().min(1),
    emergency_contact_phone: phoneHkSchema,
    form_type: z.enum(["new", "renewal"]),
    parq: parqQuestionsSchema,
    medical_clearance_file_name: z.string().optional(),
    cooling_off_acknowledged: z.boolean(),
    disclaimer_accepted: z.boolean(),
    digital_signature: z.string().min(2),
    package_sessions: z.union([z.literal(10), z.literal(30)]).optional(),
    renewal_notes: z.string().optional()
  })
  .refine((d) => d.cooling_off_acknowledged, {
    message: "請確認已閱讀 7 天冷靜期條款",
    path: ["cooling_off_acknowledged"]
  })
  .refine((d) => d.disclaimer_accepted, {
    message: "請同意免責聲明",
    path: ["disclaimer_accepted"]
  })
  .superRefine((data, ctx) => {
    if (parqRequiresClearance(data.parq) && !data.medical_clearance_file_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PAR-Q 任一題為「是」時請上載醫生證明／醫療 clearance。",
        path: ["medical_clearance_file_name"]
      });
    }
  });

export type StudentRegistrationPayload = z.infer<typeof studentRegistrationPayloadSchema>;
