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
          <h2 className="text-2xl font-semibold text-ink">分店管理</h2>
          <p className="mt-2 text-sm text-ink/70">
            分店資料包含 name、address、business start time、business end time、remarks，並支援 CSV 匯入/匯出。
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {DEFAULT_BRANCHES.map((branch) => (
            <article key={branch.name} className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-4">
              <h3 className="text-lg font-semibold text-ink">{branch.name}</h3>
              <p className="mt-1 text-sm text-ink/70">{branch.address}</p>
              <p className="mt-1 text-sm text-ink/55">
                {branch.business_start_time}–{branch.business_end_time} · {branch.remarks}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
          <h3 className="text-lg font-semibold text-ink">新增分店</h3>
          <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink/70">Name</span>
              <input
                name="name"
                required
                className="mt-1 w-full"
                placeholder="尖沙咀分店"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Address</span>
              <input
                name="address"
                required
                className="mt-1 w-full"
                placeholder="柯士甸道102號22樓"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Business Start Time</span>
              <input
                name="business_start_time"
                type="time"
                required
                defaultValue="09:00"
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Business End Time</span>
              <input
                name="business_end_time"
                type="time"
                required
                defaultValue="22:00"
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Code（CSV/教練匯入用，可留空）</span>
              <input
                name="code"
                className="mt-1 w-full"
                placeholder="TST"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-ink/70">Remarks</span>
              <textarea
                name="remarks"
                rows={3}
                className="mt-1 w-full"
                placeholder="近佐敦地鐵站D出口"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg border border-violet-200/80 bg-violet-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-violet-100"
            >
              建立分店
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadCsv("/api/admin/branches/export.csv", "branches.csv")}
              className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-emerald-100"
            >
              匯出 branches.csv
            </button>
            <label className="cursor-pointer rounded-lg border border-sky-200/80 bg-sky-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-sky-100">
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
          <p className="text-xs text-ink/55">
            CSV columns: name, address, code, business_start_time, business_end_time, remarks
          </p>
        </section>

        {status && <p className="rounded-md border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink/85">{status}</p>}

        <section className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-ink/70">
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
                    <tr className="border-b border-ink/[0.08] bg-canvas/90 text-ink/80">
                      <td colSpan={6} className="px-3 py-4">
                        <form
                          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                          onSubmit={(e) => void saveEdit(branch, e)}
                        >
                          <label className="block text-sm">
                            <span className="text-ink/55">Name</span>
                            <input
                              name="edit_name"
                              required
                              defaultValue={branch.name}
                              className="mt-1 w-full"
                            />
                          </label>
                          <label className="block text-sm md:col-span-2">
                            <span className="text-ink/55">Address</span>
                            <input
                              name="edit_address"
                              required
                              defaultValue={branch.address}
                              className="mt-1 w-full"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="text-ink/55">Business Start</span>
                            <input
                              name="edit_business_start_time"
                              type="time"
                              required
                              defaultValue={branch.business_start_time}
                              className="mt-1 w-full"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="text-ink/55">Business End</span>
                            <input
                              name="edit_business_end_time"
                              type="time"
                              required
                              defaultValue={branch.business_end_time}
                              className="mt-1 w-full"
                            />
                          </label>
                          <label className="block text-sm md:col-span-2">
                            <span className="text-ink/55">Remarks</span>
                            <textarea
                              name="edit_remarks"
                              rows={2}
                              defaultValue={branch.remarks ?? ""}
                              className="mt-1 w-full"
                            />
                          </label>
                          <p className="text-sm text-ink/50 md:col-span-2">
                            Code（只讀）: <span className="font-mono text-ink/70">{branch.code}</span>
                          </p>
                          <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-emerald-100"
                            >
                              儲存
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm text-ink hover:bg-surface"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-ink/[0.08] text-ink/80">
                      <td className="px-3 py-2 font-medium">{branch.name}</td>
                      <td className="px-3 py-2">{branch.address}</td>
                      <td className="px-3 py-2">
                        {branch.business_start_time}–{branch.business_end_time}
                      </td>
                      <td className="px-3 py-2">{branch.remarks || "—"}</td>
                      <td className="px-3 py-2 text-ink/55">{branch.code}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded-md border border-violet-300/70 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100"
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
                  <td colSpan={6} className="px-3 py-6 text-center text-ink/55">
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
