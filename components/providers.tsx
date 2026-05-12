"use client";

import { ReactNode } from "react";
import { DemoStateProvider } from "../lib/demo-state";
import CoachScopeGuard from "./coach-scope-guard";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DemoStateProvider>
      <CoachScopeGuard>{children}</CoachScopeGuard>
    </DemoStateProvider>
  );
}
