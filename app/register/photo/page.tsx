"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { alertApiError, api } from "../../../lib/api";

type RegisterContext = { hkid: string; full_name: string; pin: string };

function getContext(): RegisterContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem("zomate_register_context");
  return raw ? (JSON.parse(raw) as RegisterContext) : null;
}

export default function RegisterPhotoPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<RegisterContext | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const current = getContext();
    setCtx(current);
    if (!current) {
      router.replace("/register");
      return;
    }
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setStatus("未能開啟相機，可改用檔案上載相片。"));
  }, [router]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) setFile(new File([blob], "member-photo.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  async function submit() {
    if (!ctx || !file) {
      setStatus("請先拍攝或選擇會員相片。");
      return;
    }
    try {
      setStatus("上載相片中…");
      await api.uploadMemberPhoto(ctx.hkid, file);
      router.push("/register/receipt");
    } catch (err) {
      alertApiError(err);
      setStatus("");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-5 bg-zinc-950 p-6 text-white">
      <h1 className="text-xl font-semibold">會員相片</h1>
      <p className="text-sm text-white/75">{ctx?.full_name} · Photo required before continuing.</p>
      <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-xl border border-white/15 bg-black" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={capture} className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white">拍攝相片</button>
        <label className="rounded-md border border-white/20 px-4 py-2 text-sm">
          上載相片
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {file && <p className="text-sm text-emerald-300">已選擇：{file.name}</p>}
      {status && <p className="text-sm text-amber-200">{status}</p>}
      <button type="button" onClick={() => void submit()} className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">下一步：收據</button>
    </main>
  );
}
