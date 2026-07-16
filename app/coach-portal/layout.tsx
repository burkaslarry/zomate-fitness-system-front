import { Suspense } from "react";
import CoachPortalShell from "../../components/coach-portal-shell";

export default function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachPortalShell title="教練工作台">
      <Suspense fallback={<p className="px-3 py-8 text-center text-sm text-ink/50">載入中…</p>}>
        {children}
      </Suspense>
    </CoachPortalShell>
  );
}
