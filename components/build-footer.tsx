/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Staff UI build/version footer
 * Logic: Shows app version and deploy date on login, admin, and coach shells.
 */

import { getBuildInfoLabel } from "../lib/build-info";

export default function BuildFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      data-build-footer
      className={`text-center text-[11px] leading-5 text-ink/45 ${className}`.trim()}
    >
      {getBuildInfoLabel()}
    </footer>
  );
}
