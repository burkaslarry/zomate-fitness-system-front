"use client";

/**
 * [F008][S004]
 * Feature: Coach Session Management
 * Step: Course-type multi-select filter chips
 * Logic: Loads coach-skilled categories; groups 1-1 / 1-2 / 泰拳 visually.
 */

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export type CourseCategoryOption = { id: number; name: string };

function groupLabel(name: string): string {
  if (name.includes("泰拳")) return "泰拳";
  if (name.includes("一對二") || name.includes("1-2") || name.includes("1:2")) return "1-2";
  if (name.includes("一對一") || name.includes("1-1") || name.includes("1:1")) return "1-1";
  return "其他";
}

export default function CoachCategoryFilter({
  coachId,
  selectedIds,
  onChange,
  className = ""
}: {
  coachId: number | "";
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  className?: string;
}) {
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (coachId === "") {
      setCategories([]);
      return;
    }
    void api
      .publicCourseCategories(Number(coachId))
      .then((rows) => {
        const arr = (rows as { id: number; name: string }[]).map((r) => ({
          id: r.id,
          name: r.name
        }));
        setCategories(arr);
        setStatus("");
      })
      .catch((e) => {
        setCategories([]);
        setStatus(String(e));
      });
  }, [coachId]);

  const grouped = useMemo(() => {
    const m = new Map<string, CourseCategoryOption[]>();
    for (const c of categories) {
      const g = groupLabel(c.name);
      const list = m.get(g) ?? [];
      list.push(c);
      m.set(g, list);
    }
    return m;
  }, [categories]);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  if (coachId === "") {
    return <p className={`text-xs text-ink/50 ${className}`}>請先選擇教練。</p>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink/70">課程類型</span>
        <button
          type="button"
          onClick={() => onChange([])}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            selectedIds.length === 0
              ? "border-primary bg-primary/15 text-black"
              : "border-ink/15 bg-canvas text-ink/70 hover:border-primary/40"
          }`}
        >
          全部
        </button>
      </div>
      {[...grouped.entries()].map(([group, items]) => (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink/45">
            {group}
          </span>
          {items.map((c) => {
            const on = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on
                    ? "border-primary bg-primary/15 font-medium text-black"
                    : "border-ink/12 bg-surface text-ink/75 hover:border-primary/35"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ))}
      {status ? <p className="text-[11px] text-rose-600">{status}</p> : null}
    </div>
  );
}
