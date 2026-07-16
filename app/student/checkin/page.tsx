"use client";

/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: Search, today's lesson picker, class PIN pad
 * Logic: Check-in PDF/QR opens this page (e.g. `?from=qr`); search → pick student → today's lesson → PIN → POST /api/checkin.
 */

/*
 * Advanced block: phone + PIN fallback calls the same API with `{ phone, pin_code }`
 * (no ``student_id``). WhatsApp hooks update demo counters only.
 */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { alertApiError, api, formatApiError, getCheckinsWebSocketUrl } from "../../../lib/api";
import { useDemoState } from "../../../lib/demo-state";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";
import { useWhatsAppLog } from "../../../hooks/use-whatsapp-log";

type Ack = {
  event: string;
  student_name: string;
  student_phone: string;
  channel: string;
  lesson_balance: number;
  created_at: string;
};

type SearchRow = {
  id: number;
  full_name: string;
  phone: string;
  lesson_balance: number;
};

/** [F003][S001] One enrolled session on the Hong Kong calendar day (public API; no PIN). */
type TodayLesson = {
  course_id: number;
  title: string;
  coach_name: string;
  scheduled_start: string;
  scheduled_end: string;
};

function inputToLookupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `+852${digits}`;
  if (digits.length === 11 && digits.startsWith("852")) return `+${digits}`;
  return raw.trim();
}

function isHongKongPhoneQuery(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8;
}

function formatLessonWindow(isoStart: string, isoEnd: string): string {
  const opt: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong"
  };
  const s = new Date(isoStart).toLocaleTimeString("zh-HK", opt);
  const e = new Date(isoEnd).toLocaleTimeString("zh-HK", opt);
  return `${s} – ${e}`;
}

export default function StudentCheckinPage() {
  usePeriodicHealthPing();

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState<SearchRow | null>(null);
  const [todayLessons, setTodayLessons] = useState<TodayLesson[]>([]);
  const [todayLessonsLoading, setTodayLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<TodayLesson | null>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [acks, setAcks] = useState<Ack[]>([]);
  const [lastBalance, setLastBalance] = useState<number | null>(null);
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);
  const [fbPhone, setFbPhone] = useState("");
  const [fbPin, setFbPin] = useState("");
  const [pinPadError, setPinPadError] = useState(false);
  const [installmentPrompt, setInstallmentPrompt] = useState("");
  const { markCheckin } = useDemoState();
  const { logCheckinSuccess } = useWhatsAppLog();

  useEffect(() => {
    const wsUrl = getCheckinsWebSocketUrl();
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as Ack;
        if (parsed.event === "checkin_acknowledged") {
          setAcks((prev) => [parsed, ...prev].slice(0, 10));
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 1) {
      setResults([]);
      return;
    }
    if (!isHongKongPhoneQuery(t)) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const phone = inputToLookupPhone(t);
      try {
        const row = (await api.memberLookupByPhone(phone)) as SearchRow;
        setResults([
          {
            id: row.id,
            full_name: row.full_name,
            phone: row.phone,
            lesson_balance: row.lesson_balance
          }
        ]);
      } catch {
        const rows = (await api.studentSearch(phone.replace(/\D/g, "").slice(-8))) as SearchRow[];
        setResults(rows.filter((r) => r.phone.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-8))));
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setTodayLessons([]);
      setSelectedLesson(null);
      return;
    }
    let cancelled = false;
    setTodayLessonsLoading(true);
    (async () => {
      try {
        const rows = (await api.studentTodayLessons(selected.id)) as TodayLesson[];
        if (!cancelled) setTodayLessons(rows);
      } catch {
        if (!cancelled) setTodayLessons([]);
      } finally {
        if (!cancelled) setTodayLessonsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function redeem(e: FormEvent) {
    e.preventDefault();
    if (!selected || !selectedLesson) return;
    setStatus("扣堂中…");
    setLastBalance(null);
    setPinPadError(false);
    setInstallmentPrompt("");
    try {
      const res = (await api.checkin({
        student_id: selected.id,
        pin_code: pin.trim()
      })) as { student?: { lesson_balance?: number } };
      const bal = res.student?.lesson_balance;
      if (typeof bal === "number") setLastBalance(bal);
      markCheckin(selected.full_name, bal);
      logCheckinSuccess(selected.full_name, selected.phone, bal);
      setStatus("簽到成功！學生 WhatsApp：上堂通知 + 剩餘堂數；教練 WhatsApp：學生已簽到（示範 log）。");
      setPin("");
      setSelectedLesson(null);
      setSelected(null);
      setSearchQ("");
      setResults([]);
    } catch (err) {
      const msg = formatApiError(err);
      setPinPadError(true);
      setStatus("");
      if (msg.includes("分期 PIN 尚未啟用") || msg.includes("該期付款")) {
        setInstallmentPrompt(
          "此 PIN 對應的分期尚未付款。請先完成第 2 / 第 3 期付款，並由櫃台確認收款後再試簽到。"
        );
      } else {
        setInstallmentPrompt("");
        alertApiError(err);
      }
    }
  }

  async function fallbackSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("扣堂中…");
    setPinPadError(false);
    setInstallmentPrompt("");
    try {
      const res = (await api.checkin({
        phone: fbPhone.trim(),
        pin_code: fbPin.trim()
      })) as { student?: { lesson_balance?: number } };
      const bal = res.student?.lesson_balance;
      if (typeof bal === "number") setLastBalance(bal);
      markCheckin(fbPhone.trim(), bal);
      logCheckinSuccess("Phone User", fbPhone.trim(), bal);
      setStatus("簽到成功！");
      setFbPin("");
      setFbPhone("");
    } catch (err) {
      const msg = formatApiError(err);
      setPinPadError(true);
      setStatus("");
      if (msg.includes("分期 PIN 尚未啟用") || msg.includes("該期付款")) {
        setInstallmentPrompt(
          "此 PIN 對應的分期尚未付款。請先完成第 2 / 第 3 期付款，並由櫃台確認收款後再試簽到。"
        );
      } else {
        setInstallmentPrompt("");
        alertApiError(err);
      }
    }
  }

  function pressPinDigit(digit: string) {
    setPin((prev) => (prev.length >= 10 ? prev : `${prev}${digit}`));
  }

  function backspacePin() {
    setPin((prev) => prev.slice(0, -1));
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 pb-16 text-ink">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">Zomate 智能 QR 簽到</h1>
        <Link
          href="/student"
          className="text-sm text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          返回
        </Link>
      </div>

      <p className="text-sm text-zinc-400">
        店內簽到 QR／PDF 會連到本頁（可加 <code className="text-zinc-300">?from=qr</code>
        ）。請輸入<strong>電話號碼</strong>（8 位香港手機），按搜尋；揀學員 → 確認今日課堂 → 揀一堂 → 輸入課堂 PIN 扣堂。
      </p>

      {installmentPrompt ? (
        <section className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">分期付款提醒</p>
          <p className="mt-1">{installmentPrompt}</p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg bg-white p-4 shadow [color-scheme:light] text-slate-900">
        <h2 className="font-semibold text-slate-900">步驟 2 · 搜尋電話</h2>
        <div className="flex gap-2">
              <input
                className="min-w-0 flex-1"
                placeholder="91234567（8 位手機）"
                inputMode="tel"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch(searchQ);
                  }
                }}
                autoComplete="off"
              />
              <button
                type="button"
                aria-label="搜尋"
                title="搜尋"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-lg text-slate-900 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                onClick={() => void runSearch(searchQ)}
              >
                🔍
              </button>
            </div>
            {searching && <p className="text-xs text-ink/50">搜尋中…</p>}
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200 p-1">
              {results.length === 0 && searchQ.trim().length >= 1 && !searching && (
                <li className="space-y-2 p-2">
                  <p className="text-sm text-ink/50">
                    {isHongKongPhoneQuery(searchQ)
                      ? "找不到此電話的學員。"
                      : "請輸入至少 8 位數字的手機號碼，然後按搜尋。"}
                  </p>
                  <Link
                    href={`/student/onboard?quickName=${encodeURIComponent(searchQ.trim())}`}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-200"
                  >
                    即時登記學生
                  </Link>
                </li>
              )}
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-3 py-2 text-left text-sm transition ${
                      selected?.id === r.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                    }`}
                    onClick={() => {
                      setSelected(r);
                      setSelectedLesson(null);
                      setPin("");
                      setStatus("");
                      setPinPadError(false);
                    }}
                  >
                    <span className="font-medium">{r.full_name}</span>
                    <span className="block text-xs opacity-80">
                      {r.phone} · 目前餘額 {r.lesson_balance} 堂
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <p className="text-sm font-medium text-sky-900">
                  已揀學員：<span className="font-semibold text-slate-900">{selected.full_name}</span>
                </p>
                <p className="text-sm text-slate-600">請確認今日課堂</p>
                {todayLessonsLoading && <p className="text-xs text-ink/50">載入今日課堂…</p>}
                {!todayLessonsLoading && todayLessons.length === 0 && (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    {selected.full_name} 今日沒有課堂要上
                  </p>
                )}
                {!todayLessonsLoading && todayLessons.length > 0 && (
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 p-1">
                    {todayLessons.map((lesson) => (
                      <li key={lesson.course_id}>
                        <button
                          type="button"
                          data-testid="checkin-today-lesson"
                          className={`w-full rounded px-3 py-2 text-left text-sm transition ${
                            selectedLesson?.course_id === lesson.course_id
                              ? "bg-sky-100 ring-2 ring-sky-400"
                              : "hover:bg-slate-100"
                          }`}
                          onClick={() => {
                            setSelectedLesson(lesson);
                            setPin("");
                            setStatus("");
                            setPinPadError(false);
                          }}
                        >
                          <span className="font-medium text-slate-900">{lesson.title}</span>
                          <span className="block text-xs text-slate-600">
                            {lesson.coach_name} · {formatLessonWindow(lesson.scheduled_start, lesson.scheduled_end)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {selected && selectedLesson && (
            <section className="space-y-3 rounded-lg bg-white p-4 shadow [color-scheme:light] text-slate-900">
              <h2 className="font-semibold text-slate-900">步驟 3 · 輸入 PIN 扣堂</h2>
              <p className="text-sm text-slate-800">
                扣堂：<span className="font-medium">{selected.full_name}</span> · {selectedLesson.title}（
                {formatLessonWindow(selectedLesson.scheduled_start, selectedLesson.scheduled_end)}）
              </p>
              <form onSubmit={redeem} className="space-y-3">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="PIN（帳戶或課堂專用）"
                  value={pin}
                  readOnly
                  className="w-full"
                />
                <motion.div
                  className="grid w-full grid-cols-3 gap-2"
                  animate={pinPadError ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.42 }}
                  onAnimationComplete={() => setPinPadError(false)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="h-14 min-h-[3rem] w-full rounded-lg border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                      onClick={() => pressPinDigit(String(n))}
                      disabled={!selected || !selectedLesson}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="h-14 min-h-[3rem] w-full rounded-lg border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                    onClick={backspacePin}
                    disabled={!selected || !selectedLesson || pin.length === 0}
                  >
                    刪除
                  </button>
                  <button
                    type="button"
                    className="h-14 min-h-[3rem] w-full rounded-lg border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                    onClick={() => pressPinDigit("0")}
                    disabled={!selected || !selectedLesson}
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    className="h-14 min-h-[3rem] w-full rounded-lg border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50"
                    disabled={!selected || !selectedLesson || pin.trim().length < 4}
                  >
                    確認
                  </button>
                </motion.div>
              </form>
              {typeof lastBalance === "number" && (
                <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">
                  更新後餘額：{lastBalance} 堂（實際會經 WhatsApp 通知）
                </p>
              )}
              {status && <p className="text-sm text-slate-800">{status}</p>}
            </section>
          )}

          <button
            type="button"
            className="w-full bg-transparent text-sm text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
            onClick={() => setShowPhoneFallback((v) => !v)}
          >
            進階：唔用揀人，直接電話 + PIN
          </button>
          {showPhoneFallback && (
            <form onSubmit={fallbackSubmit} className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">進階：唔用揀人，直接電話 + PIN</p>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">電話</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+85291234567"
                  value={fbPhone}
                  onChange={(e) => setFbPhone(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="12345"
                  value={fbPin}
                  onChange={(e) => setFbPin(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                簽到
              </button>
            </form>
          )}
      {acks.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow [color-scheme:light] text-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">即時回饋</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {acks.map((a, i) => (
              <li key={`${a.created_at}-${i}`} className="border-b border-slate-100 pb-2">
                {a.student_name} · 餘 {a.lesson_balance} · {a.channel}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
