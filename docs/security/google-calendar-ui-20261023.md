# [F008][S005] Phone calendar reference refinement — 2026-10-23

Frontend-only release for the existing Vercel production project. Backend, database, payment logic and WhatsApp dispatch are unchanged. Existing main-branch Git auto-deployment is retained under the user's authorization; no additional manual deploy is triggered.

- Dependencies: full and runtime npm audit reports contain 0 vulnerabilities. No dependency changes.
- QA: 9 Playwright cases passed, including 320/375/430px calendar width, 3-day period navigation, agenda completeness, expandable mini month selection, week time-column pinning, desktop overlap/locked lessons, payment editing, signature retry and same-day booking. All fixtures intercept API calls; no customer records or messages are changed by tests.
- React review: no new packages; stable event keys, accessible button names/pressed states, confirmed-session filtering and stale-request cleanup. Phone lesson action disclosure retains the existing handlers.
- Production build: passed with Next.js 16.4.1, TypeScript validation and 58 generated routes.
- Boundaries: 7-day weekly timeline still supports horizontal date scrolling; use the 3-day view to fit all date columns on a phone. This is an appointment UI, not Google Calendar integration.
