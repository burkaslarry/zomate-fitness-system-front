/** @feature [CF07][F04.1][F03] API transport — FastAPI → PostgreSQL (zomate_fs_*) */

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

/** FastAPI `/ws/checkins` — realtime student check-ins (broadcast from POST /api/checkin). */
export function getCheckinsWebSocketUrl(): string {
  let base = API_BASE_URL;
  if (!base) {
    base =
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:8000"
        : typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.host}`
          : "http://127.0.0.1:8000";
  }
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
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
      });

      if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || "Request failed");
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
    throw new Error(text || "Upload failed");
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
    throw new Error(text || "Request failed");
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
  createBranch: (payload: { name: string; address: string; code: string }) =>
    request("/api/admin/branches", { method: "POST", body: JSON.stringify(payload) }),
  deleteBranch: (branchId: number, hard = false) =>
    request(`/api/admin/branches/${branchId}?hard=${hard ? "true" : "false"}`, { method: "DELETE" }),

  coaches: () => request("/api/admin/coaches"),
  createCoach: (payload: { full_name: string; phone: string; branch_id: number | null }) =>
    request("/api/admin/coaches", { method: "POST", body: JSON.stringify(payload) }),
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
   * Forwards `sort` and `columns` as query parameters to Spring Boot.
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
  reportsCoachAttendance: () => request("/api/v1/reports/coach-attendance"),
  sessionLedgerGet: () => request("/api/v1/session-ledger"),
  sessionLedgerPost: (payload: Record<string, unknown>) =>
    request("/api/v1/session-ledger", { method: "POST", body: JSON.stringify(payload) })
};
