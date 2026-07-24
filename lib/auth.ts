/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: localStorage auth session read and write for staff roles.
 */

export type AuthSession = {
  token: string;
  username: string;
  role: "ADMIN" | "CLERK" | "COACH";
  accessRole?: "MASTER_ADMIN" | "CLERK" | "COACH";
  isMasterAdmin?: boolean;
  permissions?: string[];
};

export function mergeAuthSessionFromMe(
  base: AuthSession,
  me: {
    token?: string;
    username?: string;
    role?: string;
    access_role?: string;
    is_master_admin?: boolean;
    permissions?: string[];
  }
): AuthSession {
  const username = me.username ?? base.username;
  const roleRaw = me.role ?? base.role;
  const role =
    roleRaw === "ADMIN" || roleRaw === "CLERK" || roleRaw === "COACH" ? roleRaw : base.role;
  let accessRole = base.accessRole;
  if (me.access_role === "MASTER_ADMIN" || me.access_role === "CLERK" || me.access_role === "COACH") {
    accessRole = me.access_role;
  } else if (username.toLowerCase() === "masterzoe" || username.toLowerCase() === "masterfung") {
    accessRole = "MASTER_ADMIN";
  } else if (role === "COACH") {
    accessRole = "COACH";
  } else if (role === "ADMIN") {
    accessRole = "MASTER_ADMIN";
  } else {
    accessRole = "CLERK";
  }
  return {
    token: me.token ?? base.token,
    username,
    role,
    accessRole,
    isMasterAdmin: Boolean(me.is_master_admin ?? accessRole === "MASTER_ADMIN"),
    permissions: Array.isArray(me.permissions) ? me.permissions : base.permissions
  };
}

const AUTH_STORAGE_KEY = "zomate_auth_session";
const AUTH_SESSION_CHANGED_EVENT = "zomate_auth_session_changed";

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
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Token session healing
 * Logic: Give a just-completed login a short window to replace a stale token before redirecting.
 */
export async function waitForSessionReplacement(previousToken: string, timeoutMs = 900): Promise<AuthSession | null> {
  if (typeof window === "undefined") return null;
  const immediate = getAuthSession();
  if (immediate?.token && immediate.token !== previousToken) return immediate;
  return new Promise((resolve) => {
    const started = Date.now();
    let timer: number | undefined;
    const finish = (session: AuthSession | null) => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onChange);
      if (timer) window.clearTimeout(timer);
      resolve(session);
    };
    const onChange = () => {
      const next = getAuthSession();
      if (next?.token && next.token !== previousToken) finish(next);
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onChange);
    timer = window.setTimeout(() => {
      const next = getAuthSession();
      finish(next?.token && next.token !== previousToken && Date.now() - started <= timeoutMs + 50 ? next : null);
    }, timeoutMs);
  });
}
