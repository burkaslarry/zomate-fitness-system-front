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

/** Prefer 尖沙咀分店 (code TST); fall back to first active branch. */
export function preferDefaultBranchId(branches: BranchLike[]): number | "" {
  if (!branches.length) return "";
  const tst =
    branches.find((b) => String(b.code ?? "").toUpperCase() === DEFAULT_BRANCH_CODE) ??
    branches.find((b) => String(b.name ?? "").includes(DEFAULT_BRANCH_NAME));
  return tst?.id ?? branches[0]?.id ?? "";
}
