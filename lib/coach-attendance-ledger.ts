/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Attendance ledger table types and status helpers
 */

export type CoachAttendanceLedgerRow = {
  branch_id: number | null;
  branch_name: string;
  coach_id: number;
  coach_name: string;
  coach_username: string | null;
  session_date: string;
  check_in_time: string;
  check_out_time: string;
  lessons_hours: string;
  course_type: string;
  status: "normal" | "late" | "absent" | "upcoming" | string;
  remarks: string;
};

export type CoachAttendanceLedgerPayload = {
  month: string;
  from_date: string;
  to_date: string;
  rows: CoachAttendanceLedgerRow[];
};

export const LEDGER_STATUS_LABEL: Record<string, string> = {
  normal: "正常",
  late: "遲到",
  absent: "缺席",
  upcoming: "待上堂"
};

export function ledgerStatusLabel(status: string): string {
  return LEDGER_STATUS_LABEL[status] ?? status;
}

export function ledgerStatusClass(status: string): string {
  switch (status) {
    case "normal":
      return "bg-emerald-500/15 text-emerald-800";
    case "late":
      return "bg-orange-500/15 text-orange-800";
    case "absent":
      return "bg-rose-500/15 text-rose-800";
    default:
      return "bg-ink/5 text-ink/55";
  }
}
