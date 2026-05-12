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
      <span className="text-ink/70">{label}</span>
      <select name={name} required={required}>
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
