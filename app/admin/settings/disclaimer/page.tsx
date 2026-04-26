"use client";

import BackendShell from "../../../../components/backend-shell";

export default function AdminSettingsDisclaimerPage() {
  return (
    <BackendShell title="免責聲明內容設定">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">免責聲明內容設定</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：可管理學生入職表單中的免責條款與健康聲明內容。
        </p>
      </div>
    </BackendShell>
  );
}
