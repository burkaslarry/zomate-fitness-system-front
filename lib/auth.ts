/*
 * CF09:AuthSessionRoles — Bearer 對應後台 ``/api/auth/login``／``auth_me`` 之 ``ADMIN``／``CLERK``／``COACH``（COACH 僅許可見 ``CoachScopeGuard`` + 教練行事曆 API）。
 */

export type AuthSession = {
  token: string;
  username: string;
  role: "ADMIN" | "CLERK" | "COACH";
};

const AUTH_STORAGE_KEY = "zomate_auth_session";

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed.username || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
