/**
 * [F007][S003]
 * Feature: Access Rights (Excel matrix)
 * Step: Client nav filter — mirrors backend ``access_rights.py``
 * Logic: MASTER_ADMIN (Masteradmin), COACH (PT), CLERK (clerk).
 */

export type AccessRole = "MASTER_ADMIN" | "CLERK" | "COACH";

export const MASTER_ADMIN_USERNAMES = new Set(["masterzoe", "masterfung"]);

export type AccessFeature = {
  key: string;
  label_zh: string;
  href: string;
  roles: AccessRole[];
};

/** Source: docs/access-rights-matrix.xlsx (zomate pt management system) */
export const ACCESS_FEATURES: AccessFeature[] = [
  { key: "register_new_member", label_zh: "加新會員", href: "/register", roles: ["MASTER_ADMIN", "COACH", "CLERK"] },
  { key: "register_course", label_zh: "加會員報堂", href: "/regCourse", roles: ["MASTER_ADMIN", "COACH", "CLERK"] },
  { key: "student_list", label_zh: "學生名單", href: "/admin/students", roles: ["MASTER_ADMIN", "COACH", "CLERK"] },
  { key: "coaches", label_zh: "教練", href: "/admin/coaches", roles: ["MASTER_ADMIN"] },
  { key: "branches", label_zh: "分店管理", href: "/admin/branches", roles: ["MASTER_ADMIN"] },
  { key: "coach_schedule_checkin", label_zh: "教練日程 · 簽到", href: "/coach/calendar", roles: ["MASTER_ADMIN", "COACH", "CLERK"] },
  { key: "coach_sessions", label_zh: "教練課表", href: "/coach", roles: ["MASTER_ADMIN"] },
  { key: "qr_checkin_console", label_zh: "QR 簽到中心", href: "/admin/attendance/qr-console", roles: ["MASTER_ADMIN"] },
  { key: "session_ledger", label_zh: "Session Ledger · 扣堂原因", href: "/admin/students", roles: ["MASTER_ADMIN"] },
  { key: "student_portal", label_zh: "學生入口", href: "/student", roles: ["MASTER_ADMIN"] },
  { key: "finance_sales", label_zh: "銷售與分期", href: "/admin/finance/sales", roles: ["MASTER_ADMIN"] },
  { key: "finance_expenses", label_zh: "支出管理", href: "/admin/finance/expenses", roles: ["MASTER_ADMIN"] },
  { key: "finance_payroll", label_zh: "薪酬 / 出勤報表", href: "/admin/finance/payroll", roles: ["MASTER_ADMIN"] },
  { key: "whatsapp_settings", label_zh: "Whatsapp 設定", href: "/admin/settings/whatsapp", roles: ["MASTER_ADMIN"] },
  { key: "system_users", label_zh: "系統帳號", href: "/admin/system-users", roles: ["MASTER_ADMIN"] },
  { key: "admin_dashboard", label_zh: "後台面板", href: "/admin", roles: ["MASTER_ADMIN", "CLERK"] },
  { key: "payments", label_zh: "付款紀錄", href: "/admin/payments", roles: ["MASTER_ADMIN", "CLERK"] },
  { key: "coach_attendance", label_zh: "教練出勤", href: "/coach/attendance", roles: ["MASTER_ADMIN"] }
];

export function normalizeAccessRole(role: string, username: string): AccessRole {
  const uname = username.trim().toLowerCase();
  if (MASTER_ADMIN_USERNAMES.has(uname)) return "MASTER_ADMIN";
  const r = role.trim().toUpperCase();
  if (r === "MASTER_ADMIN") return "MASTER_ADMIN";
  if (r === "COACH") return "COACH";
  return "CLERK";
}

export function permissionsForRole(accessRole: AccessRole): string[] {
  return ACCESS_FEATURES.filter((f) => f.roles.includes(accessRole)).map((f) => f.key);
}

export const EDITABLE_ACCESS_FEATURES = ACCESS_FEATURES.filter((f) => f.key !== "system_users");

export function permissionsAllowHref(permissions: string[], href: string): boolean {
  return ACCESS_FEATURES.some((f) => {
    if (!permissions.includes(f.key)) return false;
    if (href === f.href) return true;
    if (f.href === "/admin") return false;
    return href.startsWith(`${f.href}/`);
  });
}

export function canAccessHref(accessRole: AccessRole, href: string, permissions?: string[]): boolean {
  if (accessRole === "MASTER_ADMIN") return true;
  if (permissions?.length) return permissionsAllowHref(permissions, href);
  return ACCESS_FEATURES.some((f) => {
    if (!f.roles.includes(accessRole)) return false;
    if (href === f.href) return true;
    if (f.href === "/admin") return false;
    return href.startsWith(`${f.href}/`);
  });
}

export function labelForPermissionKey(key: string): string {
  return ACCESS_FEATURES.find((f) => f.key === key)?.label_zh ?? key;
}
