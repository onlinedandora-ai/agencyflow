# Zero-Render migration — COMPLETE

**Stack:** Next.js (Firebase App Hosting / Cloud Run) + Supabase / Cloud SQL Postgres.  
**Render / Nest API:** no longer required at runtime.

## Architecture

```
Browser → Firebase App Hosting (Next.js pages + Route Handlers)
                 ↓ Prisma
           Postgres (Supabase / Cloud SQL)
```

| Concern | Implementation |
|---------|----------------|
| API | ~75 Route Handlers under `apps/web/src/app/**/route.ts` |
| Auth | Firebase Auth + JWT + bcrypt (`apps/web/src/lib/server/auth.ts`) |
| DB | Prisma schema in `apps/api/prisma` (shared generate) |
| Automations | Cloud Scheduler / Firebase Cron → `/api/cron/automations` |
| Payments | Razorpay via `RAZORPAY_*` env |

## Local

```bash
# From repo root
# Configure DATABASE_URL, DIRECT_URL, JWT_SECRET, RAZORPAY_*, NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local
npm run db:generate
npm run dev   # web only — no Nest
```

Open http://localhost:3000

## Production env

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `DIRECT_URL` | Yes |
| `JWT_SECRET` | Yes |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | For payments |
| `CRON_SECRET` | For cron auth |
| `NEXT_PUBLIC_API_URL` | Leave **unset** (same-origin) |

## UI path notes (API vs pages)

Some legacy Nest API paths collided with Next pages. UI moved; API kept clean paths:

| API (unchanged) | UI page |
|-----------------|---------|
| `GET /proposals` | `/proposals/list` |
| `GET /projects` | `/projects/list` |
| `GET /projects/:id/board` | `/projects/board/:id` |
| `GET /invoices` | `/invoices/list` |
| `GET /portal/:token` | `/c/:token` |
| `GET /billing/doc/:token` | `/d/:token` |

## Teardown checklist

- [x] Port all Nest modules to Route Handlers
- [x] Cloud Scheduler / Firebase Cron for automations
- [x] Remove legacy proxy rewrites from `next.config.ts`
- [x] Root `npm run dev` / `build` = web only
- [x] Set Firebase and database env vars
- [x] Deploy & smoke-test production
