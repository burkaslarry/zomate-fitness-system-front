/** @feature [F01.1][F01.2][F01.3][F01.4] */

import { z } from "zod";

/** Loose HKID — validates common Hong Kong ID shape (letters + digits + check char). */
export const hkidSchema = z
  .string()
  .min(8)
  .max(12)
  .regex(/^[A-Z]{1,2}[0-9]{6}[0-9A]$/i, { message: "HKID 格式不正確（例：A1234567）" });

export const phoneHkSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^\+?[0-9][0-9\s-]{7,}$/, { message: "請輸入有效電話號碼" });

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
    package_sessions: z.union([z.literal(10), z.literal(30)]),
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
