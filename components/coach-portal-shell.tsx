"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Coach portal shell — content padding + 5-tab bottom nav
 */

import { ReactNode, Suspense } from "react";
import BackendShell from "./backend-shell";
import CoachPortalBottomNav from "./coach-portal-bottom-nav";

export default function CoachPortalShell({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <BackendShell layout="coach" title={title}>
      <div className="pb-20">{children}</div>
      <Suspense fallback={null}>
        <CoachPortalBottomNav />
      </Suspense>
    </BackendShell>
  );
}
