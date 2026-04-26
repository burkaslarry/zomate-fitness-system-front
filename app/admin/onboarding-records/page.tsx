"use client";

import BackendShell from "../../../components/backend-shell";

export default function AdminOnboardingRecordsPage() {
  return (
    <BackendShell title="入職紀錄 / 健康表單">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">入職紀錄 (Onboarding Records)</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：用作展示新學生資料、健康聲明與免責條款提交記錄。正式版可在此加入 PDF 檢視與篩選。
        </p>
      </div>
    </BackendShell>
  );
}
