# Zomate Fitness Frontend

Feature code **F015** (`Features F015:AdminChromeFrontend -- …`) is documented in `components/backend-shell.tsx` for the bilingual admin chrome. Backend codes **F001–F014** and verifier **F016** are summarized in `../zomate-fitness-system-back/README.md`.

繁體中文使用手冊：[`../docs/USER_GUIDE.zh-Hant.md`](../docs/USER_GUIDE.zh-Hant.md)。

Next.js + Tailwind UI for:

- Student onboarding and PAR-Q / disclaimer flow (F01)
- Trial purchase, course creation, course categories, and lesson balance updates (F02)
- QR + **course-specific PIN** check-in (F03)
- Admin finance reports (sales) and Excel export surfaces (F04); expenses & payroll excluded from admin reports
- Admin summary + WhatsApp/SMS simulation logs

## Local run

1. Copy `.env.example` to `.env.local`.
2. Install dependencies and start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Backend API base URL defaults to `http://127.0.0.1:8000` in development.

New management routes include:

- `/register` → member form, photo, receipt, PIN success
- `/renewal` → HKID lookup + package renewal + receipt
- `/regCourse` → course registration / payment
- `/admin/students`, `/admin/students/[hkid]`, `/admin/coaches`, `/admin/branches`
- `/admin/finance/sales`（側欄僅此項；`/admin/finance`、`expenses`、`payroll` 均重新導向至銷售與分期）
- `/admin/settings/whatsapp`（Whatsapp 設定；舊路徑 `/admin/whatsapp` 亦會導向此頁）
- `/admin/students/[hkid]` → student profile, course-specific check-in PINs, category lesson enrollment, coach trial quota

## Verify F01-F04

With the backend running on `http://127.0.0.1:8000` and connected to remote PostgreSQL:

```bash
npm run verify
npm run simulate -- http://127.0.0.1:8000
python3 ../scripts/verify_f01_f04.py http://127.0.0.1:8000
```

What is covered:

- **F01**: student registration / onboarding API, PAR-Q fields, membership expiry, public search.
- **F02**: trial purchase, admin course creation, default dynamic course categories.
- **F03**: check-in with class PIN only; duplicate same-day course check-in returns conflict.
- **F04**: sales report (admin nav); expenses & payroll excluded; session ledger.

Notes:

- The top bar shows only the current page title and the logged-in staff user.
- Quick actions (`+ 新會員`, `+ 報 Course / 收費`) live in the left menu.
- The UI uses a single warm theme from Tailwind tokens; no light/dark toggle.

## Deploy to Vercel

1. Keep `vercel.json` in this folder.
2. In Vercel project settings, set:
   - Production: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
   - Preview: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-preview-or-shared-url>.onrender.com`
3. Use this folder (`zomate-fitness-system-front`) as the project root.
4. Refer to `.env.preview.example` and `.env.production.example` for value format.
