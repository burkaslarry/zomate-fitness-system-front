"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Unified payment redirect
 * Logic: Trial / add-class split is deprecated; staff enter all receipts via `/renewal` and select Payment Type inside.
 */

import Link from "next/link";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";

export default function StudentTrialPage() {
  usePeriodicHealthPing();

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 text-ink">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">Unified Payment / Receipt Entry</h1>
        <Link
          href="/student"
          className="text-sm text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          返回
        </Link>
      </div>
      <section className="space-y-4 rounded-xl border border-purple-300 bg-white p-5 text-slate-900 shadow [color-scheme:light]">
        <p className="text-sm leading-relaxed">
          試堂／加堂獨立入口已停用。請先進入統一收錢／收據流程，再於付款形式選擇 Trial（試堂）、New Package（報堂）或 Renewal（續堂）。
        </p>
        <Link
          href="/renewal?type=trial"
          className="block rounded-md bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
        >
          前往 Unified Payment
        </Link>
      </section>
    </main>
  );
}
