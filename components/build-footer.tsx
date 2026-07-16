/**
 * [F006][S002]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Staff UI build/version footer
 * Logic: Powered-by credit plus optional version/deploy label on login and admin shells.
 */

import { getBuildInfoLabel } from "../lib/build-info";

const INNOVATEXP_URL = "https://innovatexp.co";

export default function BuildFooter({ className = "" }: { className?: string }) {
  const buildLabel = getBuildInfoLabel();
  return (
    <footer
      data-build-footer
      className={`text-center text-[11px] leading-5 text-ink/45 ${className}`.trim()}
    >
      <p>
        Powered by{" "}
        <a
          href={INNOVATEXP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ink/60 underline decoration-ink/25 underline-offset-2 hover:text-primary hover:decoration-primary/50"
        >
          InnovateXP Limited
        </a>
      </p>
      <p className="mt-0.5 text-[10px] text-ink/40">{buildLabel}</p>
    </footer>
  );
}
