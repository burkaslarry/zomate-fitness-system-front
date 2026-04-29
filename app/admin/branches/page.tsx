"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api, downloadCsv, uploadCsv } from "../../../lib/api";

type Branch = {
  id: number;
  name: string;
  address: string;
  code: string;
  business_start_time: string;
  business_end_time: string;
  remarks: string | null;
};

const DEFAULT_BRANCHES = [
  {
    name: "尖沙咀分店",
    address: "柯士甸道102號22樓",
    business_start_time: "09:00",
    business_end_time: "22:00",
    remarks: "近佐敦地鐵站D出口"
  },
  {
    name: "上環分店",
    address: "宏基商業大廈一樓全層",
    business_start_time: "09:00",
    business_end_time: "22:00",
    remarks: "上環街市及文娛中心對面"
  }
];

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadBranches() {
    setLoading(true);
    try {
      const rows = (await api.branches()) as Branch[];
      setBranches(rows);
      setStatus("");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBranches();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("建立分店中…");
    try {
      await api.createBranch({
        name: String(form.get("name") ?? "").trim(),
        address: String(form.get("address") ?? "").trim(),
        code: String(form.get("code") ?? "").trim() || undefined,
        business_start_time: String(form.get("business_start_time") ?? "09:00"),
        business_end_time: String(form.get("business_end_time") ?? "22:00"),
        remarks: String(form.get("remarks") ?? "").trim() || null
      });
      e.currentTarget.reset();
      setStatus("分店已建立。");
      await loadBranches();
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function importBranches(file: File) {
    setStatus("匯入分店 CSV 中…");
    try {
      const result = await uploadCsv("/api/admin/branches/import", file);
      setStatus(`匯入完成：${result.imported ?? 0} 筆（略過 ${result.skipped ?? 0}）。`);
      await loadBranches();
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function saveEdit(branch: Branch, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("更新分店中…");
    try {
      await api.updateBranch(branch.id, {
        name: String(form.get("edit_name") ?? "").trim(),
        address: String(form.get("edit_address") ?? "").trim(),
        business_start_time: String(form.get("edit_business_start_time") ?? ""),
        business_end_time: String(form.get("edit_business_end_time") ?? ""),
        remarks: String(form.get("edit_remarks") ?? "").trim() || null
      });
      setEditingId(null);
      setStatus("分店已更新。");
      await loadBranches();
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <BackendShell title="分店管理">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white">分店管理</h2>
          <p className="mt-2 text-sm text-slate-300">
            分店資料包含 name、address、business start time、business end time、remarks，並支援 CSV 匯入/匯出。
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {DEFAULT_BRANCHES.map((branch) => (
            <article key={branch.name} className="rounded-xl border border-white/[0.12] bg-[#111827] p-4">
              <h3 className="text-lg font-semibold text-white">{branch.name}</h3>
              <p className="mt-1 text-sm text-slate-300">{branch.address}</p>
              <p className="mt-1 text-sm text-slate-400">
                {branch.business_start_time}–{branch.business_end_time} · {branch.remarks}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-white/[0.12] bg-[#111827] p-5">
          <h3 className="text-lg font-semibold text-white">新增分店</h3>
          <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-300">Name</span>
              <input
                name="name"
                required
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                placeholder="尖沙咀分店"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Address</span>
              <input
                name="address"
                required
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                placeholder="柯士甸道102號22樓"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Business Start Time</span>
              <input
                name="business_start_time"
                type="time"
                required
                defaultValue="09:00"
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Business End Time</span>
              <input
                name="business_end_time"
                type="time"
                required
                defaultValue="22:00"
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Code（CSV/教練匯入用，可留空）</span>
              <input
                name="code"
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                placeholder="TST"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-300">Remarks</span>
              <textarea
                name="remarks"
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                placeholder="近佐敦地鐵站D出口"
              />
            </label>
            <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
              建立分店
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-xl border border-white/[0.12] bg-[#111827] p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadCsv("/api/admin/branches/export.csv", "branches.csv")}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              匯出 branches.csv
            </button>
            <label className="cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
              匯入 CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await importBranches(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="text-xs text-slate-400">
            CSV columns: name, address, code, business_start_time, business_end_time, remarks
          </p>
        </section>

        {status && <p className="rounded-md border border-white/[0.12] bg-[#0f172a] px-3 py-2 text-sm text-slate-200">{status}</p>}

        <section className="overflow-x-auto rounded-xl border border-white/[0.12] bg-[#111827]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.12] text-slate-300">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Business Hours</th>
                <th className="px-3 py-2">Remarks</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <Fragment key={branch.id}>
                  {editingId === branch.id ? (
                    <tr className="border-b border-white/[0.08] bg-[#0f172a]/80 text-slate-200">
                      <td colSpan={6} className="px-3 py-4">
                        <form
                          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                          onSubmit={(e) => void saveEdit(branch, e)}
                        >
                          <label className="block text-sm">
                            <span className="text-slate-400">Name</span>
                            <input
                              name="edit_name"
                              required
                              defaultValue={branch.name}
                              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                            />
                          </label>
                          <label className="block text-sm md:col-span-2">
                            <span className="text-slate-400">Address</span>
                            <input
                              name="edit_address"
                              required
                              defaultValue={branch.address}
                              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="text-slate-400">Business Start</span>
                            <input
                              name="edit_business_start_time"
                              type="time"
                              required
                              defaultValue={branch.business_start_time}
                              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="text-slate-400">Business End</span>
                            <input
                              name="edit_business_end_time"
                              type="time"
                              required
                              defaultValue={branch.business_end_time}
                              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                            />
                          </label>
                          <label className="block text-sm md:col-span-2">
                            <span className="text-slate-400">Remarks</span>
                            <textarea
                              name="edit_remarks"
                              rows={2}
                              defaultValue={branch.remarks ?? ""}
                              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#1e1e1e] px-3 py-2 text-white"
                            />
                          </label>
                          <p className="text-sm text-slate-500 md:col-span-2">
                            Code（只讀）: <span className="font-mono text-slate-300">{branch.code}</span>
                          </p>
                          <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
                            <button
                              type="submit"
                              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                            >
                              儲存
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-white/[0.15] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06]"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-white/[0.08] text-slate-200">
                      <td className="px-3 py-2 font-medium">{branch.name}</td>
                      <td className="px-3 py-2">{branch.address}</td>
                      <td className="px-3 py-2">
                        {branch.business_start_time}–{branch.business_end_time}
                      </td>
                      <td className="px-3 py-2">{branch.remarks || "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{branch.code}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded-md border border-violet-400/50 bg-violet-600/20 px-3 py-1 text-xs font-medium text-violet-200 hover:bg-violet-600/30"
                          onClick={() => setEditingId(branch.id)}
                        >
                          編輯
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && branches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                    未有分店資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </BackendShell>
  );
}
