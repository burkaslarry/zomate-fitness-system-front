/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Zod schemas shared by onboarding and forms.
 */

import { z } from "zod";

export const monthlySaleRowSchema = z.object({
  date: z.string(),
  clientName: z.string(),
  courseType: z.string(),
  amount: z.number(),
  coachName: z.string(),
  paymentStatus: z.string(),
  installmentStatus: z.enum(["NONE", "ACTIVE", "COMPLETE", "DEFAULT"]).optional()
});

export type MonthlySaleRowValidated = z.infer<typeof monthlySaleRowSchema>;

export const expenseRowSchema = z.object({
  id: z.string(),
  category: z.enum(["Rent", "Staff", "Utilities", "Equipment", "Other"]),
  amount: z.number().positive(),
  date: z.string(),
  memo: z.string().optional(),
  invoiceRef: z.string().optional()
});

export type ExpenseRowValidated = z.infer<typeof expenseRowSchema>;

export const expenseEntryFormSchema = z.object({
  category: expenseRowSchema.shape.category,
  amount: z.coerce.number().positive("金額須大於 0"),
  date: z.string().min(1, "請選擇日期"),
  memo: z.string().optional(),
  invoiceRef: z.string().optional()
});

export const coachAttendanceRowSchema = z.object({
  coachName: z.string(),
  month: z.string(),
  classesTaught: z.number().int().nonnegative(),
  hoursOnFloor: z.number().nonnegative(),
  grossPayHkd: z.number().nonnegative()
});

export type CoachAttendanceRowValidated = z.infer<typeof coachAttendanceRowSchema>;
