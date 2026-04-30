/** @feature [CF07][F04.1][F03] API transport — FastAPI → PostgreSQL (zomate_fs_*) */

import { clearAuthSession } from "./auth";

/*
 * Client-side fetch helper:
 * - JSON: request() + retries + Bearer from localStorage (zomate_auth_session).
 * - CSV: uploadCsv / downloadCsv / requestBlob hit FastAPI (Bearer).
 *
 * Local dev defaults to FastAPI at http://127.0.0.1:8000 so data comes from DATABASE_URL
 * on the backend (e.g. Render/eventxp PostgreSQL), not Next Route Handler mocks.
 * Opt into same-origin mocks only with NEXT_PUBLIC_USE_NEXT_MOCK_API=1.
 *
 * CF07 implementation notes:
 * 01. Read token from localStorage and attach Authorization (Bearer).
 * 02. request() retries transient 5xx responses with backoff.
 * 03. Blob helpers for authenticated CSV downloads (no bare anchor href).
 */

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Fallback when deploying to Vercel with same-origin `/api/* → Render` rewrites (`vercel.json`).
 * Browser HTTP uses relative `/api`; WebSockets cannot use that rewrite path on the Edge CDN,
 * so WS must hit FastAPI host directly (`wss://…/ws/checkins`).
 * Override anytime with NEXT_PUBLIC_BACKEND_ORIGIN.
 */
export const DEFAULT_PRODUCTION_BACKEND_ORIGIN = "https://zomate-fitness-system-back.onrender.com";

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

export function isUsingNextMockApi(): boolean {
  return API_BASE_URL === "";
}

/**
 * Origin host for realtime WebSockets (always reaches FastAPI, not the Vercel hostname).
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

/** FastAPI `/ws/checkins` — realtime student check-ins (broadcast from POST /api/checkin). */
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

/** Session rows live in Postgres; stale localStorage token → 401. Clear + send user to login. */
function redirectOnStaleAuth(path: string, status: number, bodyText: string) {
  if (status !== 401 || typeof window === "undefined") return;
  if (path === "/api/auth/login") return;
  try {
    const detail = (JSON.parse(bodyText) as { detail?: unknown }).detail;
    const d = typeof detail === "string" ? detail : "";
    if (d === "Invalid auth token." || d === "Session expired.") {
      clearAuthSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
  } catch {
    /* ignore */
  }
}

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

      // #region agent log
      if (path.includes("/api/renewal")) {
        fetch("http://127.0.0.1:7480/ingest/881a8b8b-14fd-4480-bb21-056e0c22cd5b", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "195967" },
          body: JSON.stringify({
            sessionId: "195967",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "lib/api.ts:request",
            message: "renewal_request_response_meta",
            data: {
              apiBaseUrlLength: API_BASE_URL.length,
              apiBaseEmpty: API_BASE_URL === "",
              nodeEnv: process.env.NODE_ENV,
              path,
              status: res.status,
              ok: res.ok,
              attempt
            },
            timestamp: Date.now()
          })
        }).catch(() => {});
      }
      // #endregion

      if (!res.ok) {
        const text = await res.text();
        redirectOnStaleAuth(path, res.status, text);
        // #region agent log
        if (path.includes("/api/renewal")) {
          fetch("http://127.0.0.1:7480/ingest/881a8b8b-14fd-4480-bb21-056e0c22cd5b", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "195967" },
            body: JSON.stringify({
              sessionId: "195967",
              runId: "pre-fix",
              hypothesisId: "H2",
              location: "lib/api.ts:request",
              message: "renewal_error_body",
              data: {
                status: res.status,
                bodyPreview: text.slice(0, 200)
              },
              timestamp: Date.now()
            })
          }).catch(() => {});
        }
        // #endregion
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
  member: (hkid: string) => request(`/api/members/${encodeURIComponent(hkid)}`),
  memberFull: (hkid: string) => request(`/api/members/${encodeURIComponent(hkid)}/full`),
  memberSearch: (q: string) => request(`/api/members/search?q=${encodeURIComponent(q)}`),
  uploadMemberPhoto: (hkid: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/api/members/${encodeURIComponent(hkid)}/photo`, { method: "POST", body: form });
  },
  uploadMemberReceipt: (
    hkid: string,
    payload: { file: File; amount?: string; payment_method?: string; note?: string; source?: "REGISTER" | "RENEWAL" }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.amount) form.append("amount", payload.amount);
    if (payload.payment_method) form.append("payment_method", payload.payment_method);
    if (payload.note) form.append("note", payload.note);
    form.append("source", payload.source ?? "REGISTER");
    return request(`/api/members/${encodeURIComponent(hkid)}/receipts`, { method: "POST", body: form });
  },
  resendPin: (hkid: string) =>
    request(`/api/members/${encodeURIComponent(hkid)}/resend-pin`, { method: "POST" }),
  packages: () => request("/api/packages"),
  publicCoaches: () => request("/api/coaches?active=true"),
  publicBranches: () => request("/api/branches?active=true"),
  createRenewal: (payload: {
    member_hkid: string;
    package_id: number;
    coach_id?: number;
    branch_id?: number;
    amount: string;
    payment_method: string;
    note?: string;
    receipt?: File | null;
  }) => {
    const form = new FormData();
    form.append("member_hkid", payload.member_hkid);
    form.append("package_id", String(payload.package_id));
    if (payload.coach_id) form.append("coach_id", String(payload.coach_id));
    if (payload.branch_id) form.append("branch_id", String(payload.branch_id));
    form.append("amount", payload.amount);
    form.append("payment_method", payload.payment_method);
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

  coaches: () => request("/api/admin/coaches"),
  createCoach: (payload: { full_name: string; phone: string; branch_id: number | null }) =>
    request("/api/admin/coaches", { method: "POST", body: JSON.stringify(payload) }),
  updateCoach: (
    coachId: number,
    payload: { full_name?: string; phone?: string; branch_id?: number | null; specialty?: string | null; active?: boolean }
  ) =>
    request(`/api/admin/coaches/${coachId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteCoach: (coachId: number, hard = false) =>
    request(`/api/admin/coaches/${coachId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  adminCourses: () => request("/api/admin/courses"),
  createCourse: (payload: Record<string, unknown>) =>
    request("/api/admin/courses", { method: "POST", body: JSON.stringify(payload) }),
  deleteCourse: (courseId: number, hard = false) =>
    request(`/api/admin/courses/${courseId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  deleteStudent: (studentId: number, hard = false) =>
    request(`/api/admin/students/${studentId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

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
