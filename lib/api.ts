const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/*
 * CF07: API transport layer.
 * Steps:
 * 01. 透過 localStorage 讀取 auth token 並組裝 Authorization header
 * 02. request() 提供 JSON API 重試機制
 * 03. 附加 requestBlob() 與新增刪除/匯出 API 支援
 */

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
  health: () => request("/health"),
  onboarding: (payload: Record<string, unknown>) =>
    request("/api/onboarding", { method: "POST", body: JSON.stringify(payload) }),
  listStudents: () => request("/api/students"),
  trialPurchase: (payload: unknown) =>
    request("/api/trial-purchase", { method: "POST", body: JSON.stringify(payload) }),
  /** Redeem lesson: exactly one of `phone` or `student_id` plus `pin_code`. */
  checkin: (payload: { pin_code: string; phone?: string; student_id?: number }) =>
    request("/api/checkin", { method: "POST", body: JSON.stringify(payload) }),
  studentSearch: (q: string) =>
    request(`/api/public/student-search?q=${encodeURIComponent(q)}`),
  bindFace: (studentId: number, faceIdExternal: string) =>
    request(
      `/api/students/${studentId}/bind-face?face_id_external=${encodeURIComponent(faceIdExternal)}`,
      { method: "POST" }
    ),
  faceCheckin: (payload: unknown) =>
    request("/api/faceid-checkin", { method: "POST", body: JSON.stringify(payload) }),
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

  coachCourses: (coachId: number, day?: string) =>
    request(
      day
        ? `/api/coach/courses?coach_id=${coachId}&day=${encodeURIComponent(day)}`
        : `/api/coach/courses?coach_id=${coachId}`
    ),
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
    }).toString()}`)
};
