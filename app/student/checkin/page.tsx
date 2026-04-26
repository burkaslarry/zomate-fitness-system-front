"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../../lib/api";
import { useDemoState } from "../../../lib/demo-state";
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

function isValidCheckinQrPayload(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (t.includes("/student/checkin")) return true;
  if (t.toUpperCase().startsWith("ZOMATE-CHECKIN")) return true;
  try {
    const j = JSON.parse(t) as { type?: string };
    return j?.type === "zomate_checkin";
  } catch {
    return false;
  }
}

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

export default function StudentCheckinPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const wsUrl = apiBase.replace("http://", "ws://").replace("https://", "wss://") + "/ws/checkins";

  const [gateOk, setGateOk] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState<SearchRow | null>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [acks, setAcks] = useState<Ack[]>([]);
  const [lastBalance, setLastBalance] = useState<number | null>(null);
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);
  const [fbPhone, setFbPhone] = useState("");
  const [fbPin, setFbPin] = useState("");
  const [pinPadError, setPinPadError] = useState(false);
  const { markCheckin } = useDemoState();
  const { logCheckinSuccess } = useWhatsAppLog();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("from") === "qr" || p.get("gate") === "1") {
      setGateOk(true);
      setScanMsg("已從 QR 連結進入，請搜尋姓名並輸入 PIN 扣堂。");
    }
  }, []);

  useEffect(() => {
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
  }, [wsUrl]);

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = (await api.studentSearch(t)) as SearchRow[];
      setResults(rows);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const h = window.setTimeout(() => runSearch(searchQ), 320);
    return () => window.clearTimeout(h);
  }, [searchQ, runSearch]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    setScanMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setScanMsg("無法開啟相機，請用「貼上 QR 內容」或改用有相機嘅瀏覽器。");
    }
  }

  async function captureScan() {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setScanMsg("相機未準備好");
      return;
    }
    const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!BD) {
      setScanMsg("此瀏覽器不支援 BarcodeDetector，請用 Chrome / Edge 或改用手動貼上。");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    try {
      const detector = new BD({ formats: ["qr_code"] });
      const codes = await detector.detect(canvas);
      if (!codes.length) {
        setScanMsg("未偵測到 QR，請對準啲再試。");
        return;
      }
      const raw = codes[0].rawValue;
      if (isValidCheckinQrPayload(raw)) {
        setGateOk(true);
        setScanMsg("✅ QR 有效，請於下方搜尋自己姓名。");
        stopCamera();
      } else {
        setScanMsg("QR 內容唔係簽到碼，請向職員確認。");
      }
    } catch {
      setScanMsg("掃描失敗，請再試。");
    }
  }

  function verifyPasted() {
    if (isValidCheckinQrPayload(pasteValue)) {
      setGateOk(true);
      setScanMsg("✅ 已驗證，請搜尋姓名。");
    } else {
      setScanMsg("內容唔係有效簽到 QR／連結。");
    }
  }

  async function redeem(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setStatus("扣堂中…");
    setLastBalance(null);
    setPinPadError(false);
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
      setSelected(null);
      setSearchQ("");
      setResults([]);
    } catch (err) {
      setPinPadError(true);
      setStatus(String(err));
    }
  }

  async function fallbackSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("扣堂中…");
    setPinPadError(false);
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
      setPinPadError(true);
      setStatus(String(err));
    }
  }

  function pressPinDigit(digit: string) {
    setPin((prev) => (prev.length >= 5 ? prev : `${prev}${digit}`));
  }

  function backspacePin() {
    setPin((prev) => prev.slice(0, -1));
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 pb-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">智能 QR 簽到</h1>
        <Link href="/student" className="text-sm text-slate-600 underline">
          返回
        </Link>
      </div>

      <p className="text-sm text-slate-600">
        流程：掃門口 QR → 搜尋姓名 → 揀人 → 輸入 PIN 扣一堂。課堂專用 PIN 只會通知<strong>該堂主教練</strong>
        ；帳戶 PIN 會按今日課表揀一堂再通知<strong>一位</strong>教練；無課堂則示範{" "}
        <code className="text-xs">coach-demo</code>。
      </p>

      {!gateOk && (
        <section className="space-y-3 rounded-lg bg-white p-4 shadow">
          <h2 className="font-semibold">步驟 1 · 掃描店內簽到 QR</h2>
          <p className="text-xs text-slate-500">
            支援：本頁網址、JSON <code className="break-all">{`{"type":"zomate_checkin"}`}</code>、或前綴{" "}
            <code>ZOMATE-CHECKIN</code>
          </p>
          {!cameraOn ? (
            <button type="button" onClick={startCamera}>
              開啟相機掃描
            </button>
          ) : (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full rounded-md bg-black" playsInline muted />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={captureScan}>
                  掃描此畫面
                </button>
                <button type="button" className="bg-slate-600" onClick={stopCamera}>
                  關閉相機
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-600">或貼上 QR 解碼內容／連結：</p>
            <textarea
              className="min-h-[4rem] font-mono text-xs"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="貼上掃描結果…"
            />
            <button type="button" onClick={verifyPasted}>
              驗證內容
            </button>
          </div>
          {scanMsg && <p className="text-sm text-slate-800">{scanMsg}</p>}
        </section>
      )}

      {gateOk && (
        <>
          <section className="space-y-3 rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">步驟 2 · 搜尋姓名</h2>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-60">
                🔍
              </span>
              <input
                className="!pl-10"
                placeholder="輸入姓名或電話一部份…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoComplete="off"
              />
            </div>
            {searching && <p className="text-xs text-slate-500">搜尋中…</p>}
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200 p-1">
              {results.length === 0 && searchQ.trim().length >= 1 && !searching && (
                <li className="space-y-2 p-2">
                  <p className="text-sm text-slate-500">沒有符合結果</p>
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
                      setStatus("");
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
          </section>

          <section className="space-y-3 rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">步驟 3 · 輸入 PIN 扣堂</h2>
            {!selected ? (
              <p className="text-sm text-slate-500">請先喺上面揀返自己。</p>
            ) : (
              <p className="text-sm">
                已揀：<span className="font-medium">{selected.full_name}</span>
              </p>
            )}
            <form onSubmit={redeem} className="space-y-3">
              <input inputMode="numeric" autoComplete="one-time-code" placeholder="PIN（帳戶或課堂專用）" value={pin} readOnly disabled={!selected} />
              <motion.div
                className="grid grid-cols-3 gap-2"
                animate={pinPadError ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.42 }}
                onAnimationComplete={() => setPinPadError(false)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="h-14 w-14 rounded-lg border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                    onClick={() => pressPinDigit(String(n))}
                    disabled={!selected}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="h-14 w-14 rounded-lg border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                  onClick={backspacePin}
                  disabled={!selected || pin.length === 0}
                >
                  刪除
                </button>
                <button
                  type="button"
                  className="h-14 w-14 rounded-lg border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                  onClick={() => pressPinDigit("0")}
                  disabled={!selected}
                >
                  0
                </button>
                <button
                  type="submit"
                  className="h-14 w-14 rounded-lg border border-slate-300 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  disabled={!selected || pin.trim().length < 5}
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

          <button
            type="button"
            className="w-full bg-transparent text-sm text-slate-600 underline"
            onClick={() => setShowPhoneFallback((v) => !v)}
          >
            進階：唔用揀人，直接電話 + PIN
          </button>
          {showPhoneFallback && (
            <form onSubmit={fallbackSubmit} className="space-y-2 rounded-lg border border-dashed p-4">
              <input placeholder="電話" value={fbPhone} onChange={(e) => setFbPhone(e.target.value)} />
              <input
                placeholder="PIN"
                value={fbPin}
                onChange={(e) => setFbPin(e.target.value)}
              />
              <button type="submit">簽到</button>
            </form>
          )}
        </>
      )}

      {acks.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 text-sm font-semibold">即時回饋</h2>
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
