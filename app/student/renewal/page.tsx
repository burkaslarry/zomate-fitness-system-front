"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { alertApiError, api } from "../../../lib/api";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";

type RenewalResponse = {
  message?: string;
  student?: {
    full_name?: string;
    phone?: string;
    lesson_balance?: number;
  };
  renewal?: {
    id?: number;
    lessons?: number;
    course_ratio?: string;
  };
};

type SearchRow = {
  id: number;
  full_name: string;
  phone: string;
  lesson_balance?: number;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentRenewalPage() {
  usePeriodicHealthPing();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRow[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<SearchRow | null>(null);

  const fieldClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm [color-scheme:light] placeholder:text-slate-400";

  useEffect(() => {
    const q = searchQ.trim().replace(/\s+/g, " ");
    setSearchError("");
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearchBusy(true);
      api
        .studentSearch(q)
        .then((rows) => setSearchResults(Array.isArray(rows) ? (rows as SearchRow[]) : []))
        .catch((err) => {
          setSearchResults([]);
          setSearchError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setSearchBusy(false));
    }, 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!selected) {
      setStatus("請先輸入姓名或電話搜尋資料庫，並揀選正確嘅學員。");
      return;
    }

    setSubmitting(true);
    setStatus("正在提交續會表…");

    try {
      const result = (await api.renewal({
        student_id: selected.id,
        full_name: String(form.get("full_name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        course_ratio: String(form.get("course_ratio") ?? "1:1"),
        lessons: Number(form.get("lessons") ?? 10),
        payment_method: String(form.get("payment_method") ?? "").trim(),
        coach_name: String(form.get("coach_name") ?? "").trim() || null,
        remarks: String(form.get("remarks") ?? "").trim() || null,
        applicant_name: String(form.get("applicant_name") ?? "").trim(),
        signature: String(form.get("signature") ?? "").trim(),
        renewal_date: String(form.get("renewal_date") ?? todayIsoDate())
      })) as RenewalResponse;

      const balance = result.student?.lesson_balance;
      setStatus(
        `續會已提交，已加入 ${result.renewal?.lessons ?? "所選"} 堂。${
          typeof balance === "number" ? `最新餘額：${balance} 堂。` : ""
        }`
      );
      e.currentTarget.reset();
      setSelected(null);
      setSearchQ("");
    } catch (err) {
      setStatus("");
      alertApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Zomate Fitness</p>
          <h1 className="text-2xl font-bold">Membership Renewal Form</h1>
        </div>
        <Link href="/student" className="text-sm text-slate-600 underline">
          返回
        </Link>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        備註：預約好時間後，如需改期，必須 24 小時前通知，否則不設補課。
      </p>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">① 搜尋已登記學員（資料庫）</p>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          姓名或電話（至少 1 個字）
          <input
            type="search"
            value={searchQ}
            onChange={(ev) => setSearchQ(ev.target.value)}
            className={fieldClass}
            placeholder="例如：Larry 或 9xxxx"
            autoComplete="off"
          />
        </label>
        {searchBusy && <p className="text-xs text-slate-500">搜尋中…</p>}
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}
        {!searchBusy &&
          !searchError &&
          searchQ.trim().length >= 1 &&
          searchResults.length === 0 && (
          <p className="text-sm text-amber-800">
            找不到符合嘅學員，請核對姓名／電話或聯絡職員新增學籍。
          </p>
        )}
        {searchResults.length > 0 && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
            {searchResults.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    selected?.id === row.id
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-medium">{row.full_name}</span>
                  <span className="text-slate-500"> · {row.phone}</span>
                  {typeof row.lesson_balance === "number" && (
                    <span className="block text-xs opacity-80">現有餘額 {row.lesson_balance} 堂</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <span>
              已揀選：<strong>{selected.full_name}</strong> · {selected.phone}
            </span>
            <button
              type="button"
              className="rounded-md border border-emerald-700 px-2 py-1 text-xs font-medium hover:bg-emerald-100"
              onClick={() => setSelected(null)}
            >
              重新揀選
            </button>
          </div>
        )}
      </section>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {selected ? (
          <>
            <input type="hidden" name="full_name" value={selected.full_name} />
            <input type="hidden" name="phone" value={selected.phone} />
          </>
        ) : (
          <>
            {/* Placeholders satisfy HTML constraint API until user selects */}
            <input type="hidden" name="full_name" value="" />
            <input type="hidden" name="phone" value="" />
          </>
        )}
        <p className="text-sm font-medium text-slate-800">② 填寫續會資料</p>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 [color-scheme:light]">
          <p className="text-sm font-semibold text-slate-800">由職員填寫</p>
          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">課程收費</legend>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="course_ratio" value="1:1" defaultChecked />
                1:1
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="course_ratio" value="1:2" />
                1:2
              </label>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">堂數</legend>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="lessons" value="10" defaultChecked />
                10 堂（有效期 3 個月）
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="lessons" value="30" />
                30 堂（有效期 6 個月）
              </label>
            </fieldset>
          </div>

          <label className="block w-full space-y-1 text-sm font-medium text-slate-700">
            付款方法
            <select
              name="payment_method"
              required
              className={`${fieldClass} min-h-[2.75rem]`}
              defaultValue=""
            >
              <option value="" disabled className="bg-white text-slate-900">
                請選擇
              </option>
              <option value="Cash" className="bg-white text-slate-900">
                Cash
              </option>
              <option value="FPS" className="bg-white text-slate-900">
                FPS
              </option>
              <option value="PayMe" className="bg-white text-slate-900">
                PayMe
              </option>
              <option value="Bank Transfer" className="bg-white text-slate-900">
                Bank Transfer
              </option>
              <option value="Credit Card" className="bg-white text-slate-900">
                Credit Card
              </option>
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              教練
              <input
                name="coach_name"
                className={fieldClass}
                placeholder="教練姓名"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              日期
              <input
                name="renewal_date"
                type="date"
                required
                defaultValue={todayIsoDate()}
                className={`${fieldClass} min-h-[2.75rem]`}
              />
            </label>
          </div>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            備註
            <textarea
              name="remarks"
              rows={3}
              className={fieldClass}
              placeholder="其他備註"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            申請人姓名
            <input
              name="applicant_name"
              required
              className={fieldClass}
              placeholder="申請人姓名"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            簽署
            <input
              name="signature"
              required
              className={fieldClass}
              placeholder="輸入簽署姓名"
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={submitting || !selected}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "提交中…" : selected ? "提交續會表並更新堂數" : "請先搜尋並揀選學員"}
        </button>
      </form>

      {status && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{status}</p>}
    </main>
  );
}
