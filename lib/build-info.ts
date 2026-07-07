/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Build metadata for staff UI footer
 * Logic: Version from package.json; deploy date baked at `next build` (HKT).
 */

export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "dev";
}

export function getDeployDate(): string {
  return process.env.NEXT_PUBLIC_BUILD_DATE?.trim() || "local";
}

export function getBuildInfoLabel(): string {
  return `版本 v${getAppVersion()} · 部署 ${getDeployDate()}`;
}
