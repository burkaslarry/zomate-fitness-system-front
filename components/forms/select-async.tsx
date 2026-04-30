"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name?: string; full_name?: string };

export default function SelectAsync({
  name,
  label,
  load,
  required = false
}: {
  name: string;
  label: string;
  load: () => Promise<unknown>;
  required?: boolean;
}) {
  const [rows, setRows] = useState<Option[]>([]);

  useEffect(() => {
    load().then((data) => setRows(Array.isArray(data) ? (data as Option[]) : [])).catch(() => setRows([]));
  }, [load]);

  return (
    <label className="block space-y-1 text-sm">
      <span className="text-slate-300">{label}</span>
      <select name={name} required={required} className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-white">
        <option value="">請選擇</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id} className="bg-[#1a1a1a]">
            {row.name ?? row.full_name ?? row.id}
          </option>
        ))}
      </select>
    </label>
  );
}
