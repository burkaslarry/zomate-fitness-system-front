"use client";

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: React Query and context providers for the tree.
 */

import { ReactNode } from "react";
import CoachScopeGuard from "./coach-scope-guard";

export default function Providers({ children }: { children: ReactNode }) {
  return <CoachScopeGuard>{children}</CoachScopeGuard>;
}
