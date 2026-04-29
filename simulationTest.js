#!/usr/bin/env node
/**
 * Mirrors `scripts/remote-db-simulation.sh` — exercises FastAPI + PostgreSQL endpoints.
 *
 * Usage:
 *   npm run simulate
 *   npm run simulate -- http://127.0.0.1:8000
 *   API_BASE_URL=https://your-api.example.com npm run simulate
 */

const BASE = (
  process.argv[2] ||
  process.env.API_BASE_URL ||
  process.env.API_BASE ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function j(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

async function main() {
  console.log("");
  console.log("== simulationTest (FastAPI + remote DB) base:", BASE);

  let r = await fetch(`${BASE}/api/health`);
  if (!r.ok) throw new Error(`GET /api/health → ${r.status}`);
  console.log("[OK] GET /api/health");

  r = await fetch(`${BASE}/api/health/db`);
  const db = await j(r);
  if (!r.ok) throw new Error(`GET /api/health/db → ${r.status}`);
  if (db.database !== "connected") {
    console.error(db);
    throw new Error("GET /api/health/db database not connected");
  }
  console.log("[OK] GET /api/health/db:", db.status, db.database);

  r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "masterzoe", password: "12345678" })
  });
  const login = await j(r);
  if (!r.ok) throw new Error(`POST /api/auth/login → ${r.status}`);
  const TOKEN = typeof login.token === "string" ? login.token : "";
  if (!TOKEN) throw new Error("No token from login");
  console.log("[OK] POST /api/auth/login (token)");

  const auth = { Authorization: `Bearer ${TOKEN}` };

  r = await fetch(`${BASE}/api/admin/summary`, { headers: auth });
  const summary = await j(r);
  if (!r.ok) throw new Error(`GET /api/admin/summary → ${r.status}`);
  console.log("[OK] GET /api/admin/summary — total_students:", summary.total_students);

  r = await fetch(`${BASE}/api/public/student-search?q=a`);
  if (!r.ok) throw new Error(`GET /api/public/student-search → ${r.status}`);
  console.log("[OK] GET /api/public/student-search?q=a");

  r = await fetch(`${BASE}/api/admin/branches`, { headers: auth });
  if (!r.ok) throw new Error(`GET /api/admin/branches → ${r.status}`);
  console.log("[OK] GET /api/admin/branches");

  r = await fetch(`${BASE}/api/admin/coaches`, { headers: auth });
  if (!r.ok) throw new Error(`GET /api/admin/coaches → ${r.status}`);
  console.log("[OK] GET /api/admin/coaches");

  r = await fetch(`${BASE}/api/v1/reports/sales`, { headers: auth });
  if (!r.ok) console.warn("[WARN] GET /api/v1/reports/sales →", r.status);
  else console.log("[OK] GET /api/v1/reports/sales");

  console.log("== simulationTest done ===");
  console.log("");
}

main().catch((e) => {
  console.error("[FAIL]", e.message || e);
  process.exit(1);
});
