"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name?: string; full_name?: string; code?: string };

export default function SelectAsync({
  name,
  label,
  load,
  required = false,
  defaultBranchCode
}: {
  name: string;
  label: string;
  load: () => Promise<unknown>;
  required?: boolean;
  /** 分店 API 回傳 `code` 時可預選（例如種子資料尖沙咀為 TST）。 */
  defaultBranchCode?: string;
}) {
  const [rows, setRows] = useState<Option[]>([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        const arr = Array.isArray(data) ? (data as Option[]) : [];
        if (cancelled) return;
        setRows(arr);
        if (defaultBranchCode) {
          const match = arr.find((r) => String(r.code ?? "") === defaultBranchCode);
          if (match) setValue(String(match.id));
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [load, defaultBranchCode]);

  return (
    <label className="block space-y-1 text-sm">
      <span className="text-ink/70">{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
      >
        <option value="">請選擇</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name ?? row.full_name ?? row.id}
          </option>
        ))}
      </select>
    </label>
  );
}
