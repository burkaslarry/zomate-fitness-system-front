/**
 * [F001][S005]
 * Feature: Docker / Vercel asset proxy
 * Step: Stream files from FastAPI uploads volume via same-origin route
 * Logic: Frontend cannot fetch container absolute paths; proxy with precise MIME headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PRODUCTION_BACKEND_ORIGIN } from "../../../../lib/api";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf"
};

function resolveBackendOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBase) return apiBase.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return "http://127.0.0.1:8000";
  return DEFAULT_PRODUCTION_BACKEND_ORIGIN;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const relative = path.map((p) => p.replace(/\.\./g, "")).join("/");
  if (!relative) {
    return new NextResponse("Not found", { status: 404 });
  }
  const upstream = `${resolveBackendOrigin()}/uploads/${relative}`;
  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return new NextResponse("Not found", { status: res.status });
    }
    const ext = relative.includes(".") ? relative.slice(relative.lastIndexOf(".")).toLowerCase() : "";
    const contentType = MIME_BY_EXT[ext] || res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new NextResponse("Upstream unavailable", { status: 502 });
  }
}
