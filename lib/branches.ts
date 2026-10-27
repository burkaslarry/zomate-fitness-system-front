/**
 * [F007][S002]
 * Feature: Branch / Course Category Management
 * Step: Prefer 尖沙咀分店 (TST) as default branch for student course flows
 * Logic: Resolve by code `TST` then name; never hardcode numeric id.
 */

export type BranchLike = {
  id: number;
  code?: string | null;
  name?: string | null;
};

export const DEFAULT_BRANCH_CODE = "TST";
export const DEFAULT_BRANCH_NAME = "尖沙咀分店";

/** [F001][S001] Codes allowed on new-member registration. */
const MEMBER_HOME_BRANCH_CODES = new Set(["TST", "SW", "SHEUNGWAN"]);

/** Prefer 尖沙咀分店 (code TST); fall back to first active branch. */
export function preferDefaultBranchId(branches: BranchLike[]): number | "" {
  if (!branches.length) return "";
  const tst =
    branches.find((b) => String(b.code ?? "").toUpperCase() === DEFAULT_BRANCH_CODE) ??
    branches.find((b) => String(b.name ?? "").includes(DEFAULT_BRANCH_NAME));
  return tst?.id ?? branches[0]?.id ?? "";
}

/** [F001][S001] Only SW / TST for 新會友加入. */
export function memberHomeBranches(branches: BranchLike[]): BranchLike[] {
  return branches.filter((b) => MEMBER_HOME_BRANCH_CODES.has(String(b.code ?? "").toUpperCase()));
}

/** Label for registration select: `尖沙咀 (TST)`. */
export function memberBranchLabel(branch: BranchLike): string {
  const code = String(branch.code ?? "").toUpperCase();
  const short = code === "SHEUNGWAN" ? "SW" : code;
  const name = String(branch.name ?? "").trim() || short;
  if (short === "TST") return `${name.includes("尖沙咀") ? name : "尖沙咀分店"} (TST)`;
  if (short === "SW") return `${name.includes("上環") ? name : "上環分店"} (SW)`;
  return `${name} (${short})`;
}
