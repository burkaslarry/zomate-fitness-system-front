"use client";

import { useEffect } from "react";
import { api } from "../lib/api";

/** 預設 10 分鐘 — 與後台 / kiosk 保持 API 連線探測。 */
export const PERIODIC_HEALTH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 週期呼叫 `GET /api/health`（liveness）。失敗時靜默略過（不打斷使用者流程）。
 */
export function usePeriodicHealthPing(intervalMs: number = PERIODIC_HEALTH_INTERVAL_MS) {
  useEffect(() => {
    const ping = () => {
      void api.health().catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
