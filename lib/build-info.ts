/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Build metadata for staff UI footer
 * Logic: Version from git prod/* tag at build (see scripts/resolve-prod-version.mjs); date HKT.
 */

export function getAppVersion(): string {
  const raw = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (!raw) return "vdev";
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function getDeployDate(): string {
  return process.env.NEXT_PUBLIC_BUILD_DATE?.trim() || "local";
}

export function getBuildInfoLabel(): string {
  return `版本 ${getAppVersion()} · 更新時間: ${getDeployDate()}`;
}
