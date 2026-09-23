# AgencyFlow

End-to-end agency operations platform by **SreeDrisya Media** — replaces Zoho CRM, Zoho Projects, Zoho Books, and manual SOP tracking.

See [prd.md](./prd.md) for the full product requirements document.

## Stack

| Layer | Tech |
|-------|------|
| App (UI + API) | Next.js 16 Route Handlers on **Firebase App Hosting / Cloud Run** |
| Database | **Supabase / Google Cloud SQL** Postgres via Prisma |
| Auth | Firebase Auth + JWT + bcrypt (Next server) |
| Automations | Cloud Scheduler / Firebase Cron |
| Payments | Razorpay (optional) |

> NestJS on Render has been retired. See [MIGRATION.md](./MIGRATION.md) and [DEPLOY.md](./DEPLOY.md).

## Quick start

1. Create `apps/web/.env.local` (copy from `apps/web/.env.example`) with Supabase/Cloud SQL URLs, `JWT_SECRET`, and Firebase keys.

2. Generate Prisma client and seed (schema lives under `apps/api/prisma`):

```bash
npm run db:generate
npm run db:seed
```

3. Run the app (web only):

```bash
npm run dev
```

Open http://localhost:3000 — demo: `admin@agencyflow.com` / `demo123` or Sign in with Google.

### Optional — local Docker Postgres

```bash
npm run db:up
# Point DATABASE_URL and DIRECT_URL in apps/web/.env.local at localhost:5433
npm run db:migrate
npm run db:seed
npm run dev
```

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agencyflow.com | demo123 |
| Client Manager | manager@agencyflow.com | demo123 |
| Delivery Exec | exec@agencyflow.com | demo123 |

## Deploy to production

Push to `main` → Firebase auto-deploys `apps/web`.

**Firebase env:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_FIREBASE_*`, optional `RAZORPAY_*`, `CRON_SECRET`.  
Leave `NEXT_PUBLIC_API_URL` unset (same-origin API).

Full checklist: [DEPLOY.md](./DEPLOY.md).

## Project structure

```
agencyflow/
├── apps/
│   ├── web/          # Next.js UI + API (Route Handlers)
│   └── api/          # Prisma schema + seed definitions
├── MIGRATION.md
├── DEPLOY.md
├── prototype/
├── docker-compose.yml
├── prd.md
└── package.json
```
