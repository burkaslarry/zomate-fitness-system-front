# Zomate Fitness Frontend Demo

Next.js + Tailwind local demo UI for:
- Student onboarding
- Trial purchase + lesson balance updates
- QR+PIN check-in
- Hikvision FaceID simulation
- Admin summary + WhatsApp simulation logs

## Local run

1. Copy `.env.local.example` to `.env.local`.
2. Install dependencies and start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Backend API base URL defaults to `http://localhost:8000`.

## Deploy to Vercel

1. Keep `vercel.json` in this folder.
2. In Vercel project settings, set:
   - Production: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`
   - Preview: `NEXT_PUBLIC_API_BASE_URL=https://<your-render-preview-or-shared-url>.onrender.com`
3. Use this folder (`zomate-fitness-system-front`) as the project root.
4. Refer to `.env.preview.example` and `.env.production.example` for value format.