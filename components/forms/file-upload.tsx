"use client";

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
    <label className="block rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 text-sm text-white">
      <span className="font-medium">{label}</span>
      <span className="mt-1 block text-xs text-white/55">Drag-drop or click to upload. Images/PDF only, max 5MB.</span>
      <input
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="mt-3 block w-full text-xs text-white/80"
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
        <img src={preview} alt="Upload preview" className="mt-3 max-h-40 rounded-lg border border-white/15 object-contain" />
      )}
      {pdfName && <span className="mt-3 block rounded-lg border border-white/15 px-3 py-2 text-xs">PDF: {pdfName}</span>}
      {error && <span className="mt-2 block text-xs text-rose-300">{error}</span>}
    </label>
  );
}
