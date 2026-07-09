# AgencyFlow

End-to-end agency operations platform by **SreeDrisya Media** — replaces Zoho CRM, Zoho Projects, Zoho Books, and manual SOP tracking.

See [prd.md](./prd.md) for the full product requirements document.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, TanStack Query |
| Backend | NestJS, Prisma, PostgreSQL |
| Database | **Supabase** (hosted Postgres, Mumbai region) |
| Cache/Queue | Redis via Docker locally (ready for BullMQ) |

## Quick start

### Option A — Supabase (recommended)

Prisma is already installed in `apps/api`. Schema is at `apps/api/prisma/schema.prisma`.

1. Copy env and paste your **database password** from [Supabase → Connect → ORM → Prisma](https://supabase.com/dashboard/project/nwxshrpsunitweeoiuvy):

```bash
cp apps/api/.env.example apps/api/.env
# Replace YOUR_DB_PASSWORD in DATABASE_URL and DIRECT_URL
```

2. Push schema and seed demo data:

```bash
cd apps/api && npx prisma db push && npm run prisma:seed
```

3. Run dev servers:

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Supabase dashboard: https://supabase.com/dashboard/project/nwxshrpsunitweeoiuvy

### Option B — Local Docker Postgres

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Set both `DATABASE_URL` and `DIRECT_URL` to `postgresql://agencyflow:agencyflow@localhost:5433/agencyflow?schema=public` in `apps/api/.env`.

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agencyflow.com | demo123 |
| Client Manager | manager@agencyflow.com | demo123 |
| Delivery Exec | exec@agencyflow.com | demo123 |

## Deploy to production

### 1. Database (Supabase) — already configured

- Project: `nwxshrpsunitweeoiuvy` — [dashboard](https://supabase.com/dashboard/project/nwxshrpsunitweeoiuvy) (Singapore region)
- Copy `DATABASE_URL` (pooler, port 6543) and `DIRECT_URL` (direct, port 5432) into your API host

### 2. API (Render / Railway / Docker)

**Option A — Render blueprint** (includes API + Web):

```bash
# Connect repo at render.com → New Blueprint → use render.yaml
```

**Option B — Docker** (any host):

```bash
docker build -f apps/api/Dockerfile -t agencyflow-api .
docker run -p 3001:3001 \
  -e DATABASE_URL="..." \
  -e DIRECT_URL="..." \
  -e JWT_SECRET="..." \
  -e WEB_ORIGIN="https://your-app.vercel.app" \
  agencyflow-api
```

API env vars:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase pooler URL (pgbouncer) |
| `DIRECT_URL` | Supabase direct URL (migrations) |
| `JWT_SECRET` | Random secret for auth tokens |
| `WEB_ORIGIN` | Vercel URL(s), comma-separated if multiple |
| `PORT` | `3001` |

Health check: `GET /health`

**Render free tier cold start:** The API sleeps after ~15 minutes of inactivity. The first request after sleep can take **~30 seconds** while the container boots. This is not app slowness — retry once after a short wait. The web app pings `/health` on load and login to wake the API early. For always-on production, upgrade Render to a paid instance or use an external uptime ping (e.g. UptimeRobot → `https://your-api.onrender.com/health` every 10 minutes).

### 3. Web (Vercel)

1. Import repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `apps/web`
3. Add env var:

```
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

4. Deploy — `vercel.json` already configures monorepo install/build

Or via CLI:

```bash
cd apps/web
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
vercel link
vercel --prod
```

### 4. Post-deploy checklist

- [ ] API `/health` returns OK
- [ ] Login works on production URL
- [ ] CORS: `WEB_ORIGIN` matches your Vercel domain exactly
- [ ] Run seed once on production if needed: `npm run db:seed --workspace=apps/api`

## MVP progress (Phase 1)

- [x] Monorepo scaffold (`apps/web`, `apps/api`)
- [x] PostgreSQL schema (users, leads, workspaces, projects, tasks, invoices)
- [x] JWT auth with role model
- [x] CRM lead pipeline with 30-minute SLA tracking
- [x] Kanban pipeline UI
- [x] Discovery call sheet (10-question form)
- [x] Proposal builder (6 sections, 300-word guardrail, 24h timer, case studies)
- [x] Client onboarding with advance-payment gate
- [x] Task boards by service line (Kanban + gate)
- [x] shadcn/ui + Apple glassmorphism theme
- [x] Supabase production database
- [ ] Invoicing + payment automation (Razorpay)

## Project structure

```
agencyflow/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS API + Prisma
├── prototype/        # Original static HTML demo
├── docker-compose.yml
├── prd.md
└── package.json
```
