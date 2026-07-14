# AgencyFlow

End-to-end agency operations platform by **SreeDrisya Media** — replaces Zoho CRM, Zoho Projects, Zoho Books, and manual SOP tracking.

See [prd.md](./prd.md) for the full product requirements document.

## Stack

| Layer | Tech |
|-------|------|
| App (UI + API) | Next.js 16 Route Handlers on **Vercel** |
| Database | **Supabase** Postgres via Prisma |
| Auth | JWT + bcrypt (Next server) |
| Automations | Vercel Cron |
| Payments | Razorpay (optional) |

> NestJS on Render has been retired. See [MIGRATION.md](./MIGRATION.md) and [DEPLOY.md](./DEPLOY.md).

## Quick start

1. Create `apps/web/.env.local` (copy from `apps/web/.env.example`) with Supabase URLs + `JWT_SECRET`.

2. Generate Prisma client and seed (schema lives under `apps/api/prisma`):

```bash
npm run db:generate
npm run db:seed
```

3. Run the app (web only):

```bash
npm run dev
```

Open http://localhost:3000 — demo: `admin@agencyflow.com` / `demo123`  
Supabase: https://supabase.com/dashboard/project/nwxshrpsunitweeoiuvy

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

Push to `main` → Vercel auto-deploys `apps/web`.

**Vercel env:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, optional `RAZORPAY_*`, `CRON_SECRET`.  
Leave `NEXT_PUBLIC_API_URL` unset (same-origin API).

Full checklist: [DEPLOY.md](./DEPLOY.md).

## Project structure

```
agencyflow/
├── apps/
│   ├── web/          # Next.js UI + API (Route Handlers)
│   └── api/          # Legacy Nest (Prisma schema + seed only)
├── MIGRATION.md
├── DEPLOY.md
├── prototype/
├── docker-compose.yml
├── prd.md
└── package.json
```
