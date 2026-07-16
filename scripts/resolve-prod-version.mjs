/**
 * [F006][S002]
 * Resolve production semver from git tag `prod/X.Y.Z` → `vX.Y.Z` for footer / build env.
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repoRoot = dirname(fileURLToPath(new URL("../", import.meta.url)));

function git(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** @param {string} raw e.g. prod/1.2.0, prod/1.11-whatsapp-reminders, prod/1.11-whatsapp-reminders-6-gabc */
export function prodTagToVersionLabel(raw) {
  const m = String(raw || "").match(/^prod\/(\d+(?:\.\d+)*)/);
  return m ? `v${m[1]}` : "";
}

/** Prefer tag on HEAD, then nearest prod/* describe, then latest prod/* tag. */
export function resolveProdVersionLabel(fallback = "vdev") {
  const onHead = git("git tag --points-at HEAD --list 'prod/*' --sort=-v:refname");
  if (onHead) {
    const first = onHead.split("\n").map((t) => t.trim()).filter(Boolean)[0];
    const label = prodTagToVersionLabel(first);
    if (label) return label;
  }

  const described = git("git describe --tags --match 'prod/*' --always");
  const fromDescribe = prodTagToVersionLabel(described);
  if (fromDescribe) return fromDescribe;

  const latest = git("git tag -l 'prod/*' --sort=-v:refname");
  if (latest) {
    const first = latest.split("\n").map((t) => t.trim()).filter(Boolean)[0];
    const label = prodTagToVersionLabel(first);
    if (label) return label;
  }

  return fallback;
}

export function resolveBuildDateHkt() {
  const env = process.env.NEXT_PUBLIC_BUILD_DATE?.trim();
  if (env) return env;
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}
