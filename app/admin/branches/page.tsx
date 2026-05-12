"use client";

import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type { BranchDto, TrialClassKindDto } from "../../../types/api";

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [kinds, setKinds] = useState<TrialClassKindDto[]>([]);
  const [status, setStatus] = useState("");

  const reloadBranches = useCallback(() => {
    api
      .branches()
      .then((data) => setBranches(Array.isArray(data) ? (data as BranchDto[]) : []))
      .catch((e) => alertApiError(e));
  }, []);

  const reloadKinds = useCallback(() => {
    api
      .adminTrialClassKinds()
      .then((data) => setKinds(Array.isArray(data) ? (data as TrialClassKindDto[]) : []))
      .catch((e) => alertApiError(e));
  }, []);

  useEffect(() => {
    reloadBranches();
    reloadKinds();
  }, [reloadBranches, reloadKinds]);

  async function toggleKind(row: TrialClassKindDto, nextActive: boolean) {
    setStatus("");
    try {
      await api.patchTrialClassKind(row.id, { active: nextActive });
      await reloadKinds();
      setStatus("已更新課程種類狀態。");
    } catch (e) {
      alertApiError(e);
    }
  }

  return (
    <BackendShell title="分店管理">
      <div className="mx-auto max-w-5xl space-y-10">
        <div>
          <h2 className="text-2xl font-semibold text-ink">分店管理</h2>
          <p className="mt-1 text-sm text-ink/65">分店資料與「課程種類」維護（試堂與 Course 套餐開課標題共用）。</p>
        </div>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-ink">分店列表</h3>
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
                <tr>
                  <th className="px-4 py-2 font-medium">名稱</th>
                  <th className="px-4 py-2 font-medium">代碼</th>
                  <th className="px-4 py-2 font-medium">地址</th>
                  <th className="px-4 py-2 font-medium">營業時間</th>
                  <th className="px-4 py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.code}</td>
                    <td className="max-w-xs px-4 py-3 text-xs">{b.address}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {b.business_start_time && b.business_end_time
                        ? `${b.business_start_time}–${b.business_end_time}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {b.active !== false ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-800">啟用</span>
                      ) : (
                        <span className="rounded-full bg-ink/10 px-2 py-1 text-xs text-ink/55">停用</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">Course 種類（試堂／開課共用）</h3>
              <p className="mt-1 text-xs text-ink/55">編輯「啟用」會影響試堂下拉與 Course 套餐開課的課程名稱選項。</p>
            </div>
          </div>
          {status ? <p className="text-sm text-emerald-800">{status}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-ink/10 bg-canvas/50 text-ink/65">
                <tr>
                  <th className="px-4 py-2 font-medium">課程名稱</th>
                  <th className="px-4 py-2 font-medium">啟用</th>
                </tr>
              </thead>
              <tbody>
                {kinds.map((row) => (
                  <tr key={row.id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3">{row.label_zh}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleKind(row, !row.active)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                          row.active
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900"
                            : "border-ink/15 bg-canvas text-ink/55"
                        }`}
                      >
                        {row.active ? "Y" : "N"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </BackendShell>
  );
}
