"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "../../../lib/api";

export default function StudentFacePage() {
  const [status, setStatus] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("處理中…");
    try {
      await api.faceCheckin({ face_id_external: form.get("face_id_external") });
      setStatus("FaceID 示範簽到完成。");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">FaceID（示範）</h1>
        <Link href="/student" className="text-sm text-slate-600 underline">
          返回
        </Link>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg bg-white p-4 shadow">
        <input name="face_id_external" placeholder="face_id_external（如 HKV-0001）" required />
        <button type="submit">簽到</button>
      </form>
      {status && <p className="text-sm">{status}</p>}
    </main>
  );
}
