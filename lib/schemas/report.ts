/** @feature [F04.1][F04.2][F04.3][F04.4][F04.5] */

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

export const sessionLedgerReasonSchema = z.enum(["attended", "late_cancel", "coach_makeup"]);

export const sessionLedgerEntrySchema = z.object({
  studentName: z.string().min(1),
  sessionStartIso: z.string(),
  cancelledAtIso: z.string().optional(),
  reason: sessionLedgerReasonSchema,
  notes: z.string().optional()
});

export type SessionLedgerEntryValidated = z.infer<typeof sessionLedgerEntrySchema>;

/** Late cancellation: within 24h of scheduled session start → invalidates standard refund rules (demo rule flag). */
export function isLateCancellation(sessionStartIso: string, cancelledAtIso: string): boolean {
  const start = new Date(sessionStartIso).getTime();
  const cancel = new Date(cancelledAtIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(cancel)) return false;
  const hours = (start - cancel) / (1000 * 60 * 60);
  return hours >= 0 && hours < 24;
}
