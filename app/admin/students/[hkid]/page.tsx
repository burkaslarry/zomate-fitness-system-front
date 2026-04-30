"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackendShell from "../../../../components/backend-shell";
import { alertApiError, api } from "../../../../lib/api";
import type { MemberFull } from "../../../../types/api";

const tabs = ["資料", "Package", "收據", "活動紀錄"] as const;

export default function AdminStudentDetailPage() {
  const params = useParams<{ hkid: string }>();
  const [data, setData] = useState<MemberFull | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("資料");
  const [toast, setToast] = useState("");
  const hkid = decodeURIComponent(params.hkid);

  useEffect(() => {
    api.memberFull(hkid).then((row) => setData(row as MemberFull)).catch(alertApiError);
  }, [hkid]);

  return (
    <BackendShell title="學生詳情">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-xl border border-white/15 bg-[#111827] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">{data?.profile.full_name ?? hkid}</h2>
              <p className="mt-1 text-sm text-slate-300">{data?.profile.hkid} · {data?.profile.phone}</p>
            </div>
            {data?.profile.is_active && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200">活躍</span>}
            <button type="button" onClick={() => setToast("WhatsApp 未接駁")} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white">Resend PIN</button>
          </div>
          {toast && <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-amber-100">{toast}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm ${tab === item ? "bg-[#6366f1] text-white" : "bg-white/10 text-slate-200"}`}>
              {item}
            </button>
          ))}
        </div>
        <section className="rounded-xl border border-white/15 bg-[#111827] p-5 text-slate-200">
          {tab === "資料" && data && (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
                {data.profile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.profile.photo_url} alt={data.profile.full_name} className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">No photo</div>}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs text-slate-400">Email</dt><dd>{data.profile.email ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-400">PIN</dt><dd className="font-mono">{data.profile.pin_code}</dd></div>
                <div><dt className="text-xs text-slate-400">Emergency</dt><dd>{data.profile.emergency_contact_name ?? "—"} · {data.profile.emergency_contact_phone ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-400">Remaining</dt><dd>{data.profile.lesson_balance} 堂</dd></div>
              </dl>
            </div>
          )}
          {tab === "Package" && <Rows rows={data?.packages ?? []} />}
          {tab === "收據" && (
            <div className="grid gap-3 md:grid-cols-3">
              {(data?.receipts ?? []).map((r) => (
                <a key={r.id} href={r.file_url ?? "#"} target="_blank" className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm" rel="noreferrer">
                  <span className="block font-medium">{r.source} · {r.payment_method ?? "未填"}</span>
                  <span className="mt-1 block text-slate-400">${r.amount ?? 0} · {new Date(r.created_at).toLocaleDateString()}</span>
                </a>
              ))}
            </div>
          )}
          {tab === "活動紀錄" && <Rows rows={data?.activity_log ?? []} />}
        </section>
      </div>
    </BackendShell>
  );
}

function Rows({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-sm text-slate-400">暫無記錄</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <pre key={index} className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-200">{JSON.stringify(row, null, 2)}</pre>
      ))}
    </div>
  );
}
