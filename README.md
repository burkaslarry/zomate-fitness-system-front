# Zomate Fitness Frontend Demo

繁體中文使用手冊：[`docs/USER_GUIDE.zh-Hant.md`](docs/USER_GUIDE.zh-Hant.md)。

Next.js + Tailwind local demo UI for:
- Student onboarding
- Trial purchase + lesson balance updates
- QR+PIN check-in
- Hikvision FaceID simulation
- Admin summary + WhatsApp simulation logs

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
- `/trial-class` → trial/add-on class record
- `/admin/students`, `/admin/coaches`, `/admin/branches`, `/admin/finance`, `/admin/whatsapp`

## Deploy to Vercel

1. Keep `vercel.json` in this folder.
2. In Vercel project settings, set:
   - Production: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
   - Preview: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-preview-or-shared-url>.onrender.com`
3. Use this folder (`zomate-fitness-system-front`) as the project root.
4. Refer to `.env.preview.example` and `.env.production.example` for value format.