/**
 * [F006][S001]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: API base & WebSocket origin resolution
 * Logic: Resolve `NEXT_PUBLIC_API_BASE_URL`, optional same-origin mocks, dev default to FastAPI, WS host for `/ws/checkins`.
 */

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: API base & WebSocket origin resolution
 * Logic: Same-origin `/api` on Vercel rewrites; WS must target FastAPI host (`NEXT_PUBLIC_BACKEND_ORIGIN` or production default).
 */
export const DEFAULT_PRODUCTION_BACKEND_ORIGIN = "https://zomate-fitness-system-back.onrender.com";

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: API base & WebSocket origin resolution
 * Logic: Explicit base → mock mode → dev `127.0.0.1:8000` → production same-origin.
 */
function resolveApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) {
    return normalizeApiBase(explicit);
  }
  if (process.env.NEXT_PUBLIC_USE_NEXT_MOCK_API === "1") {
    return "";
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  return "";
}

const API_BASE_URL = resolveApiBaseUrl();

/** Resolved API origin (empty = same-origin Next mock routes when opted in). */
export function getResolvedApiBaseUrl(): string {
  return API_BASE_URL;
}

/** Build absolute URL for FastAPI-served uploads (``/uploads/...``). */
export function apiAssetUrl(relativeOrAbsolute: string | null | undefined): string | undefined {
  if (!relativeOrAbsolute) return undefined;
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const path = relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
  const base = API_BASE_URL;
  if (!base) return path;
  return `${base}${path}`;
}

export function isUsingNextMockApi(): boolean {
  return API_BASE_URL === "";
}

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: API base & WebSocket origin resolution
 * Logic: `NEXT_PUBLIC_BACKEND_ORIGIN` → `API_BASE_URL` → dev default → `DEFAULT_PRODUCTION_BACKEND_ORIGIN`.
 */
function resolveWebSocketBackendOrigin(): string {
  const envOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  if (envOrigin) {
    return normalizeApiBase(envOrigin);
  }
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  return normalizeApiBase(DEFAULT_PRODUCTION_BACKEND_ORIGIN);
}

/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: QR scan / paste — realtime channel for coach calendar
 * Logic: Build `wss://`/`ws://` URL to FastAPI `/ws/checkins` using resolved backend origin.
 */
export function getCheckinsWebSocketUrl(): string {
  const base = resolveWebSocketBackendOrigin();
  const path = "/ws/checkins";
  if (base.startsWith("https://")) {
    return `wss://${base.slice(8).replace(/\/$/, "")}${path}`;
  }
  if (base.startsWith("http://")) {
    return `ws://${base.slice(7).replace(/\/$/, "")}${path}`;
  }
  return `${base.replace(/\/$/, "")}${path}`;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse FastAPI `{"detail":"..."}` or validation array into a short user-facing message. */
function errorFromApiBody(bodyText: string, fallback: string): Error {
  const raw = bodyText.trim();
  if (!raw) return new Error(fallback);
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown; error?: unknown };
    if (typeof parsed.message === "string") return new Error(parsed.message);
    const d = parsed.detail;
    if (typeof d === "string") return new Error(d);
    if (Array.isArray(d)) {
      const parts = d.map((item) => {
        if (item && typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return typeof item === "string" ? item : JSON.stringify(item);
      });
      const joined = parts.filter(Boolean).join("\n");
      if (joined) return new Error(joined);
    }
  } catch {
    /* plain text/HTML error body */
  }
  return new Error(raw);
}

function authErrorMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { detail?: unknown; message?: unknown };
    const detail = typeof parsed.detail === "string" ? parsed.detail : "";
    const message = typeof parsed.message === "string" ? parsed.message : "";
    return message || detail;
  } catch {
    return bodyText.trim();
  }
}

export function isStaleAuthMessage(message: string): boolean {
  return message === "Invalid auth token." || message === "Session expired." || message === "Missing auth token.";
}

/** Normalized message from API throws (already parsed by `errorFromApiBody` where applicable). */
export function formatApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Native popup — use for backend errors so users never only see raw JSON. */
export function alertApiError(err: unknown): void {
  if (typeof window === "undefined") return;
  window.alert(formatApiError(err));
}

/**
 * [F006][S002]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: Bearer auth & stale session redirect
 * Logic: On 401 with expired/invalid token, notify the shell; it gets one chance to heal before logout.
 */
function redirectOnStaleAuth(path: string, status: number, bodyText: string) {
  if (status !== 401 || typeof window === "undefined") return;
  if (path === "/api/auth/login") return;
  const message = authErrorMessage(bodyText);
  if (isStaleAuthMessage(message)) {
    window.dispatchEvent(new CustomEvent("zomate_stale_auth", { detail: { path, message } }));
  }
}

/**
 * [F006][S002]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: Bearer auth & stale session redirect
 * Logic: Read JWT from `localStorage` (`zomate_auth_session`) for `Authorization: Bearer`.
 */
function authHeaders() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem("zomate_auth_session");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ? { Authorization: `Bearer ${parsed.token}` } : {};
  } catch {
    return {};
  }
}

/**
 * [F006][S003]
 * Feature: Shared API client (Next.js → FastAPI)
 * Step: JSON fetch with retries & error shaping
 * Logic: Attach Bearer headers, retry transient 5xx with backoff, normalize FastAPI `detail` into `Error`.
 */
async function request(path: string, options?: RequestInit) {
  let lastError: Error | null = null;
  const headers = new Headers(options?.headers);
  const auth = authHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  if (options?.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const fullUrl = `${API_BASE_URL}${path}`;
      const res = await fetch(fullUrl, {
        ...options,
        headers
      });

      if (!res.ok) {
        const text = await res.text();
        redirectOnStaleAuth(path, res.status, text);
        const err = errorFromApiBody(text, "Request failed");
        if (res.status < 500) {
          throw err;
        }
        lastError = err;
      } else {
        return res.json();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError ?? new Error("Request failed after retries.");
}

export async function uploadCsv(path: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const headers = new Headers();
  const auth = authHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) {
    const text = await res.text();
    redirectOnStaleAuth(path, res.status, text);
    throw errorFromApiBody(text, "Upload failed");
  }
  return res.json() as Promise<{ imported?: number; skipped?: number }>;
}

async function requestBlob(path: string) {
  const headers = new Headers();
  const auth = authHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    redirectOnStaleAuth(path, res.status, text);
    throw errorFromApiBody(text, "Request failed");
  }
  return res.blob();
}

/** Authenticated CSV download — routes live in `zomate-fitness-system-back` (FastAPI), data in `zomate_fs_*` tables. */
export async function downloadCsv(path: string, filename: string) {
  const blob = await requestBlob(path);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** @deprecated Prefer `downloadCsv()` — plain links cannot send Bearer token. */
export const csvUrl = {
  studentsExport: () => `${API_BASE_URL}/api/admin/students/export.csv`,
  branchesExport: () => `${API_BASE_URL}/api/admin/branches/export.csv`,
  coachesExport: () => `${API_BASE_URL}/api/admin/coaches/export.csv`
};

export const api = {
  login: (payload: { username: string; password: string }) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  health: () => request("/api/health"),
  /** Readiness — PostgreSQL（同 GET /health/db）。 */
  healthDb: () => request("/api/health/db"),
  onboarding: (payload: Record<string, unknown>) =>
    request("/api/onboarding", { method: "POST", body: JSON.stringify(payload) }),
  /** Full Zod-validated registration (F01). */
  studentsRegisterV1: (payload: Record<string, unknown>) =>
    request("/api/v1/students/register", { method: "POST", body: JSON.stringify(payload) }),
  createMember: (payload: Record<string, unknown>) =>
    request("/api/members", { method: "POST", body: JSON.stringify(payload) }),
  /** F01 步驟 1 — 檢查姓名／簡填 HKID／電話是否已有紀錄（公開，毋須 Bearer）。 */
  memberDuplicateCheck: (payload: { full_name: string; hkid: string; phone: string }) =>
    request("/api/members/duplicate-check", { method: "POST", body: JSON.stringify(payload) }),
  member: (hkid: string) => request(`/api/members/${encodeURIComponent(hkid)}`),
  memberFull: (hkid: string) => request(`/api/members/${encodeURIComponent(hkid)}/full`),
  memberFullById: (studentId: number | string) => request(`/api/members/by-id/${encodeURIComponent(String(studentId))}/full`),
  updateMemberById: (
    studentId: number | string,
    payload: {
      full_name?: string;
      phone?: string;
      email?: string | null;
      date_of_birth?: string | null;
      emergency_contact_name?: string | null;
      emergency_contact_phone?: string | null;
    }
  ) =>
    request(`/api/members/by-id/${encodeURIComponent(String(studentId))}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  memberSearch: (q: string) => request(`/api/members/search?q=${encodeURIComponent(q)}`),
  /** 續會 / 試堂：以香港電話查唯一學員（接受 8 位或 +852） */
  memberLookupByPhone: (phone: string) =>
    request(`/api/members/lookup-phone?phone=${encodeURIComponent(phone)}`),
  trialClassKinds: () => request("/api/trial-class-kinds"),
  /** Course／試堂種類 — 後台含停用列（分店管理）。 */
  adminTrialClassKinds: () => request("/api/admin/trial-class-kinds"),
  patchTrialClassKind: (kindId: number, payload: { active: boolean }) =>
    request(`/api/admin/trial-class-kinds/${kindId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  uploadMemberPhoto: (hkid: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/api/members/${encodeURIComponent(hkid)}/photo`, { method: "POST", body: form });
  },
  uploadMemberReceipt: (
    hkid: string,
    payload: { file: File; amount?: string; payment_method?: string; note?: string; source?: "REGISTER" | "RENEWAL"; context?: string }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.amount) form.append("amount", payload.amount);
    if (payload.payment_method) form.append("payment_method", payload.payment_method);
    if (payload.note) form.append("note", payload.note);
    if (payload.context) form.append("context", payload.context);
    form.append("source", payload.source ?? "REGISTER");
    return request(`/api/members/${encodeURIComponent(hkid)}/receipts`, { method: "POST", body: form });
  },
  uploadMemberReceiptById: (
    studentId: number | string,
    payload: { file: File; amount?: string; payment_method?: string; note?: string; source?: "REGISTER" | "RENEWAL"; context?: string }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.amount) form.append("amount", payload.amount);
    if (payload.payment_method) form.append("payment_method", payload.payment_method);
    if (payload.note) form.append("note", payload.note);
    if (payload.context) form.append("context", payload.context);
    form.append("source", payload.source ?? "RENEWAL");
    return request(`/api/members/by-id/${encodeURIComponent(String(studentId))}/receipts`, { method: "POST", body: form });
  },
  resendPin: (hkid: string) =>
    request(`/api/members/${encodeURIComponent(hkid)}/resend-pin`, { method: "POST" }),
  packages: () => request("/api/packages"),
  publicCoaches: () => request("/api/coaches?active=true"),
  publicBranches: () => request("/api/branches?active=true"),
  createRenewal: (payload: {
    student_id?: number;
    member_hkid?: string;
    student_phone?: string;
    /** [F002][S001] Admin-entered lesson count; PIN remains package/payment based, not per lesson. */
    total_lessons: number;
    coach_id?: number;
    branch_id?: number;
    amount: string;
    payment_method: string;
    transaction_type?: "trial" | "new_package" | "renewal";
    course_package_type_code?: string;
    course_package_type_label?: string;
    note?: string;
    receipt?: File | null;
  }) => {
    const form = new FormData();
    if (payload.student_id != null) form.append("student_id", String(payload.student_id));
    if (payload.member_hkid) form.append("member_hkid", payload.member_hkid);
    if (payload.student_phone) form.append("student_phone", payload.student_phone);
    form.append("total_lessons", String(payload.total_lessons));
    if (payload.coach_id) form.append("coach_id", String(payload.coach_id));
    if (payload.branch_id) form.append("branch_id", String(payload.branch_id));
    form.append("amount", payload.amount);
    form.append("payment_method", payload.payment_method);
    if (payload.transaction_type) form.append("transaction_type", payload.transaction_type);
    if (payload.course_package_type_code) form.append("course_package_type_code", payload.course_package_type_code);
    if (payload.course_package_type_label) form.append("course_package_type_label", payload.course_package_type_label);
    if (payload.note) form.append("note", payload.note);
    if (payload.receipt) form.append("receipt", payload.receipt);
    return request("/api/renewals", { method: "POST", body: form });
  },
  createTrialClass: (payload: Record<string, unknown>) =>
    request("/api/trial-classes", { method: "POST", body: JSON.stringify(payload) }),
  financeSummary: (query: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (query.from) sp.set("from", query.from);
    if (query.to) sp.set("to", query.to);
    return request(`/api/finance/summary?${sp.toString()}`);
  },
  createExpense: (payload: Record<string, unknown>) =>
    request("/api/expenses", { method: "POST", body: JSON.stringify(payload) }),
  renewal: (payload: Record<string, unknown>) =>
    request("/api/renewal", { method: "POST", body: JSON.stringify(payload) }),
  listStudents: () => request("/api/students"),
  trialPurchase: (payload: unknown) =>
    request("/api/trial-purchase", { method: "POST", body: JSON.stringify(payload) }),
  /** Redeem lesson: exactly one of `phone` or `student_id` plus `pin_code`. */
  checkin: (payload: { pin_code: string; phone?: string; student_id?: number }) =>
    request("/api/checkin", { method: "POST", body: JSON.stringify(payload) }),
  studentSearch: (q: string) =>
    request(`/api/public/student-search?q=${encodeURIComponent(q)}`),
  /** [F003][S001] Today's enrolled sessions (HK calendar) for check-in lesson picker. */
  studentTodayLessons: (studentId: number) =>
    request(`/api/public/student-today-lessons?student_id=${encodeURIComponent(String(studentId))}`),
  summary: () => request("/api/admin/summary"),
  whatsappLogs: () => request("/api/admin/whatsapp-logs"),
  auditLogs: (limit?: number) =>
    request(
      limit != null
        ? `/api/admin/audit-logs?limit=${encodeURIComponent(String(limit))}`
        : "/api/admin/audit-logs"
    ),
  checkins: (checkinDate?: string) =>
    request(
      checkinDate ? `/api/checkins?checkin_date=${encodeURIComponent(checkinDate)}` : "/api/checkins"
    ),

  branches: () => request("/api/admin/branches"),
  createBranch: (payload: {
    name: string;
    address: string;
    code?: string;
    business_start_time: string;
    business_end_time: string;
    remarks?: string | null;
  }) =>
    request("/api/admin/branches", { method: "POST", body: JSON.stringify(payload) }),
  updateBranch: (branchId: number, payload: Record<string, unknown>) =>
    request(`/api/admin/branches/${branchId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBranch: (branchId: number, hard = false) =>
    request(`/api/admin/branches/${branchId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  coaches: (query?: { q?: string; search_by?: "name" | "phone" }) => {
    const sp = new URLSearchParams();
    if (query?.q) sp.set("q", query.q);
    if (query?.search_by) sp.set("search_by", query.search_by);
    const qs = sp.toString();
    return request(`/api/admin/coaches${qs ? `?${qs}` : ""}`);
  },
  createCoach: (payload: {
    full_name: string;
    phone: string;
    branch_id: number | null;
    hire_date?: string | null;
  }) => request("/api/admin/coaches", { method: "POST", body: JSON.stringify(payload) }),
  updateCoach: (
    coachId: number,
    payload: {
      full_name?: string;
      phone?: string;
      branch_id?: number | null;
      specialty?: string | null;
      active?: boolean;
      hire_date?: string | null;
    }
  ) =>
    request(`/api/admin/coaches/${coachId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteCoach: (coachId: number, hard = false) =>
    request(`/api/admin/coaches/${coachId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  adminCourses: () => request("/api/admin/courses"),
  adminCoursesByDay: (day: string) =>
    request(`/api/admin/courses/by-day?day=${encodeURIComponent(day)}`),
  assignCourseCoach: (courseId: number, coachId: number) =>
    request(`/api/admin/courses/${courseId}/assign-coach`, {
      method: "PATCH",
      body: JSON.stringify({ coach_id: coachId })
    }),
  createCourse: (payload: Record<string, unknown>) =>
    request("/api/admin/courses", { method: "POST", body: JSON.stringify(payload) }),
  markCourseInstallmentPaid: (courseId: number, payload: { student_id: number; installment_no: number }) =>
    request(`/api/admin/courses/${courseId}/installment-paid`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteCourse: (courseId: number, hard = false) =>
    request(`/api/admin/courses/${courseId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  deleteStudent: (studentId: number, hard = false) =>
    request(`/api/admin/students/${studentId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  courseCategories: (includeDeleted = false) =>
    request(
      includeDeleted ? "/api/admin/course-categories?include_deleted=true" : "/api/admin/course-categories"
    ),
  createCourseCategory: (payload: { name: string }) =>
    request("/api/admin/course-categories", { method: "POST", body: JSON.stringify(payload) }),
  hideCourseCategory: (categoryId: number) =>
    request(`/api/admin/course-categories/${categoryId}/hide`, { method: "POST" }),
  showCourseCategory: (categoryId: number) =>
    request(`/api/admin/course-categories/${categoryId}/show`, { method: "POST" }),
  upsertStudentCategoryEnrollment: (
    studentId: number,
    payload: { course_category_id: number; total_lessons: number; total_installments?: number }
  ) =>
    request(`/api/admin/students/${studentId}/category-enrollment`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  grantCoachTrial: (
    studentId: number,
    payload?: { coach_id?: number | null; branch_id?: number | null; class_date?: string | null }
  ) =>
    request(`/api/admin/students/${studentId}/coach-trial-grant`, {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }),

  coachCourses: (
    coachId: number,
    query?: string | { day?: string; fromDate?: string; toDate?: string }
  ) => {
    const sp = new URLSearchParams({ coach_id: String(coachId) });
    if (typeof query === "string") {
      sp.set("day", query);
    } else if (query && typeof query === "object") {
      if (query.day) sp.set("day", query.day);
      if (query.fromDate) sp.set("from_date", query.fromDate);
      if (query.toDate) sp.set("to_date", query.toDate);
    }
    return request(`/api/coach/courses?${sp.toString()}`);
  },
  rescheduleCourse: (courseId: number, coachId: number, payload: Record<string, string>) =>
    request(`/api/coach/courses/${courseId}?coach_id=${coachId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  qrcodePdfUrl: (kind: string, origin?: string, payload?: string) => {
    const params = new URLSearchParams({ kind });
    if (origin) params.set("origin", origin);
    if (payload) params.set("payload", payload);
    return `${API_BASE_URL}/api/admin/qrcode-pdf?${params.toString()}`;
  },
  qrcodePdfBlob: (kind: string, origin?: string, payload?: string) =>
    requestBlob(`/api/admin/qrcode-pdf?${new URLSearchParams({
      kind,
      ...(origin ? { origin } : {}),
      ...(payload ? { payload } : {})
    }).toString()}`),

  /**
   * Monthly / course sales report for admin dashboards.
   * Forwards `sort` and `columns` as query parameters to the API (`GET /api/v1/reports/sales`).
   */
  reportsSales: (query?: { sort?: string; columns?: string }) => {
    const sp = new URLSearchParams();
    if (query?.sort) sp.set("sort", query.sort);
    if (query?.columns) sp.set("columns", query.columns);
    const qs = sp.toString();
    return request(`/api/v1/reports/sales${qs ? `?${qs}` : ""}`);
  },
  reportsExpenses: () => request("/api/v1/reports/expenses"),
  postExpenseEntry: (payload: Record<string, unknown>) =>
    request("/api/v1/reports/expenses", { method: "POST", body: JSON.stringify(payload) }),
  reportsCoachAttendance: (query?: { month?: string }) => {
    const sp = new URLSearchParams();
    if (query?.month) sp.set("month", query.month);
    const qs = sp.toString();
    return request(`/api/v1/reports/coach-attendance${qs ? `?${qs}` : ""}`);
  },
  sessionLedgerGet: () => request("/api/v1/session-ledger"),
  sessionLedgerPost: (payload: Record<string, unknown>) =>
    request("/api/v1/session-ledger", { method: "POST", body: JSON.stringify(payload) })
};
