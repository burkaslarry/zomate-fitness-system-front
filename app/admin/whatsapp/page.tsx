"use client";

import BackendShell from "../../../components/backend-shell";

export default function AdminWhatsappPage() {
  return (
    <BackendShell title="WhatsApp">
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-8 text-center">
          {/* TODO: connect WhatsApp provider once API credentials and webhook requirements are confirmed. */}
          <h2 className="text-2xl font-semibold text-ink">WhatsApp 未接駁</h2>
          <p className="mt-2 text-sm text-ink/70">Coming soon</p>
        </div>
      </div>
    </BackendShell>
  );
}
