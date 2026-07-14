# Production deploy checklist

> **Current stack:** Vercel (Next.js UI + API) + Supabase (Postgres).  
> **Render Nest API is retired** — see [MIGRATION.md](./MIGRATION.md).

## Production setup

| Service | Project | URL | Deploy |
|---------|---------|-----|--------|
| **App (UI + API)** | Vercel `agencyflow-api` | https://agencyflow-api.vercel.app | Git push → `main` |
| **DB** | Supabase | Singapore pooler | `npm run db:migrate` / seed |

**Vercel**

- Repo: `vaitahavya/agencyflow`
- Root directory: `apps/web`
- Branch: `main`

## Standard workflow

```bash
git config --local user.name "vaitahavya"
git config --local user.email "194759526+vaitahavya@users.noreply.github.com"

git add -A && git commit -m "Your message"
git push origin main
```

Vercel rebuilds the full app (pages + Route Handlers + crons).

## Required Vercel environment variables

```
DATABASE_URL=<Supabase pooler URL — no quotes>
DIRECT_URL=<Supabase session/direct URL — no quotes>
JWT_SECRET=<long random string>
RAZORPAY_KEY_ID=<optional>
RAZORPAY_KEY_SECRET=<optional>
CRON_SECRET=<random string for cron auth>
```

Leave `NEXT_PUBLIC_API_URL` **unset** so the browser uses same-origin `/…` API routes.

Do **not** set `NEST_API_PROXY_URL` or point at Render.

## Local

```bash
# apps/web/.env.local — copy DB + JWT from former apps/api/.env
npm run db:generate
npm run dev
```

## DB migrations / seed

Prisma schema still lives under `apps/api/prisma`:

```bash
npm run db:migrate
npm run db:seed
```

## Verify

- [ ] `GET https://agencyflow-api.vercel.app/health` → `{"status":"ok","runtime":"next",…}`
- [ ] Login with `admin@agencyflow.com` / `demo123`
- [ ] Pipeline loads; archive works
- [ ] Project board loads
- [ ] (Optional) Razorpay portal payment with live keys

## Retire Render

1. Confirm production healthy on Vercel alone  
2. Render dashboard → delete/suspend `agencyflow-api`  
3. Remove any leftover DNS/env pointing at `*.onrender.com`
