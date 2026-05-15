"use client";

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Reusable form primitives: upload, select, payment radio.
 */

import { useEffect, useState } from "react";

export default function FileUpload({
  name,
  label,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  required = false
}: {
  name: string;
  label: string;
  accept?: string;
  required?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <label className="block rounded-xl border border-dashed border-ink/20 bg-canvas/80 p-4 text-sm text-ink shadow-sm ring-1 ring-ink/[0.04]">
      <span className="font-medium">{label}</span>
      <span className="mt-1 block text-xs text-ink/55">拖放或按此上載。支援圖片／PDF，上限 5MB。</span>
      <input
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="mt-3 block w-full text-xs text-ink/80 file:mr-3 file:rounded-md file:border file:border-ink/15 file:bg-primary/90 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setError("");
          setPdfName("");
          if (preview) URL.revokeObjectURL(preview);
          setPreview(null);
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            setError("檔案不可超過 5MB");
            event.target.value = "";
            return;
          }
          if (file.type.startsWith("image/")) {
            setPreview(URL.createObjectURL(file));
          } else if (file.type === "application/pdf") {
            setPdfName(file.name);
          }
        }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Upload preview" className="mt-3 max-h-40 rounded-lg border border-ink/10 object-contain" />
      )}
      {pdfName && <span className="mt-3 block rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs text-ink">PDF: {pdfName}</span>}
      {error && <span className="mt-2 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
