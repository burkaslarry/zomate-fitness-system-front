# Zomate Fitness Frontend

Feature code **F015** (`Features F015:AdminChromeFrontend -- …`) is documented in `components/backend-shell.tsx` for the bilingual admin chrome. Backend codes **F001–F014** and verifier **F016** are summarized in `../zomate-fitness-system-back/README.md`.

繁體中文使用手冊：[`docs/USER_GUIDE.zh-Hant.md`](docs/USER_GUIDE.zh-Hant.md)。

Next.js + Tailwind UI for:

- Student onboarding and PAR-Q / disclaimer flow (F01)
- Trial purchase, course creation, course categories, and lesson balance updates (F02)
- QR + **course-specific PIN** check-in (F03)
- Admin finance reports (sales) and Excel export surfaces (F04); expenses & payroll excluded from admin reports
- Admin summary + Meta WhatsApp payment notifications and application logs

## [F005][S003] WhatsApp payment notifications / 付款通知

The production FastAPI backend uses sender **+852 9756 8105**. Four approved `zh_HK` templates cover pending receipt, installment, full-payment and coach notifications; the existing booking confirmation is preserved. The backend was committed, pushed and deployed as `c4368e2` on 2026-10-13; the user confirmed receipt of all four real test sends with synthetic data.

付款／續會提交、收據上傳及後台手動 reminder 會按收據／分期狀態選範本；有對應教練及電話且開啟通知時加發教練版本。不是定時或每次簽到自動發送。上傳收據目前即視為有收據；`reg-course-wizard.tsx` 先建立付款再建立課程，首次通知的課程／PIN／分期及金額仍須流程驗收。後台測試 API 只限 masterzoe；正常付款操作沿用原權限。課程名稱等欄位是動態資料，測試字眼沒有寫死在模板。

See the [user guide](docs/USER_GUIDE.zh-Hant.md#六通知與整合參考) for checkbox behavior, triggers, delivery evidence and current limitations. View [production WhatsApp settings](https://zomate-fitness-system-front.vercel.app/admin/settings/whatsapp) to check runtime mappings. Editing a database preview does not change the approved Meta fixed wording.

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
- `/admin/payments` → CRM payment records (HKT dates; ADMIN soft-delete)
- `/admin/attendance/qr-console` → **新會員加入** / **簽到** QR hub (one-click open + PDF export)
- `/admin/finance/sales`（側欄僅此項；`/admin/finance`、`expenses`、`payroll` 均重新導向至銷售與分期）
- `/admin/settings/whatsapp`（Whatsapp 設定；舊路徑 `/admin/whatsapp` 亦會導向此頁）
- `/coach`, `/coach/calendar`, `/coach/attendance` → staff coach session views (unified on `GET /api/coach/sessions`)
- `/coach-portal/**` → COACH role portal (schedule, students, report)
- `/admin/students/[hkid]` → student profile, course-specific check-in PINs, category lesson enrollment, coach trial quota

**Production tag:** `prod/1.14` — see root [`../README.md`](../README.md) Deploy section for SRAA + Vercel/Render URLs.

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

**SRAA gate (Security Risk Assessment & Audit):** before every production deploy, run automated dependency remediation and block on high/critical findings.

```bash
npm run predeploy          # npm audit fix → audit --audit-level=high → next build
# or
./scripts/pre-deploy-vercel.sh
npm run deploy:vercel      # gate + vercel --prod (requires Vercel CLI)
```

Do **not** use `npm audit fix --force` — it can downgrade Next.js and break the app.

GitHub Actions workflow `.github/workflows/sraa-predeploy.yml` runs the same gate on `main` PRs and pushes. **Production deploys are handled by the Vercel Git integration** (`vercel[bot]`). After the SRAA gate passes on `main`, the workflow **verifies** that the Vercel Production deployment for that commit succeeded (no `VERCEL_TOKEN` secret required).

### GitHub Actions → Vercel (auto-deploy on merge)

1. Keep the Vercel GitHub app connected to this repo (Production deploys on push to `main`).
2. Commit `.vercel/project.json` (tracked; contains `orgId` + `projectId` from `vercel link`).
3. Every push to `main` runs SRAA → build → verify Vercel Production. Production URL: `https://zomate-fitness-system-front.vercel.app`.

Optional CLI deploy (local / manual only — needs a personal Vercel token):

```bash
./scripts/setup-vercel-github-secrets.sh   # only if you restore a CLI-based Actions deploy
npm run deploy:vercel                      # gate + vercel --prod
```

Manual project settings:

1. Keep `vercel.json` in this folder.
2. In Vercel project settings, set:
   - Production: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
   - Preview: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-preview-or-shared-url>.onrender.com`
3. Use this folder (`zomate-fitness-system-front`) as the project root.
4. Refer to `.env.preview.example` and `.env.production.example` for value format.

<!--
Repository maintenance: GitHub remotes use the burkaslarry-GitHub SSH alias,
which selects this account's SSH key and connects over port 443.
-->

### [F003][S003] 簽到通知範本選擇（2026-10-13 更新）

開課、教練排課、成功簽到及補分期／全額收據均沿用四款原文。`[F001][S001]` 新人／續會／報 Course 的 WhatsApp 同意未勾時不能提交；`[F002][S001] components/reg-course-wizard.tsx` 把續會付款與新課程／PIN 關聯，成功畫面使用後端批准原文；`[F004][S002] components/payment-records-table.tsx` 在 Admin 付款詳情直接預覽 JPG／PNG 收據，保留開啟／下載。手機及手動 WhatsApp 連結预設 +852。

English: agreed template text stays fixed; course title, financial state and PIN are injected by the API. Typecheck and production build passed; receipt preview passed browser image-load verification with the user's sample. On 2026-10-13 the vulnerable Tailwind 3 dependency chain was removed by migrating to Tailwind/PostCSS 4.3.3. Both all-dependency and production audits report zero vulnerabilities, with no exception or scanner suppression. CSS source paths/theme now live in `app/globals.css`; focus outlines and the warm theme are preserved. Tailwind 4 supports Safari 16.4+, Chrome 111+, Firefox 128+. The user authorized deployment after the repair; verify hosting status against the commit rather than assuming a push is live.


### [F003][S002] Latest SOP / 最新流程 - 2026-10-19

首期未付款仍發五位 PIN，僅限首期堂數；第二／三期由 Admin 確認足額後發新 PIN，舊 PIN 不可跨期。學生／教練上傳收據不自行解鎖；Admin 確認會同步原有學生／教練通知，重複確認不換碼、不重發。學生詳情頁提供持續確認入口。

English: first-term credit is distinct from paid status; later PIN issuance is gated by Admin confirmation and the current lesson tranche. Provider-stub regression tests cover these rules. No new live WhatsApp test is implied.
