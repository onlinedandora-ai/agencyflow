# Zero-Render migration — COMPLETE

**Stack:** Next.js (Vercel) + Supabase Postgres only.  
**Render / Nest API:** no longer required at runtime.

## Architecture

```
Browser → Vercel (Next.js pages + Route Handlers)
                ↓ Prisma
           Supabase Postgres
```

| Concern | Implementation |
|---------|----------------|
| API | ~75 Route Handlers under `apps/web/src/app/**/route.ts` |
| Auth | JWT + bcrypt (`apps/web/src/lib/server/auth.ts`) |
| DB | Prisma schema still in `apps/api/prisma` (shared generate) |
| Automations | Vercel Cron → `/api/cron/automations` |
| Payments | Razorpay via `RAZORPAY_*` env on Vercel |

## Local

```bash
# From repo root
cp apps/api/.env values into apps/web/.env.local  # DATABASE_URL, DIRECT_URL, JWT_SECRET, RAZORPAY_*
npm run db:generate
npm run dev   # web only — no Nest
```

Open http://localhost:3000

## Vercel env

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `DIRECT_URL` | Yes |
| `JWT_SECRET` | Yes |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | For payments |
| `CRON_SECRET` | For cron auth |
| `NEXT_PUBLIC_API_URL` | Leave **unset** (same-origin) |

**Remove:** any `NEXT_PUBLIC_API_URL=…onrender.com`, `NEST_API_PROXY_URL`, Render service.

## UI path notes (API vs pages)

Some Nest API paths collided with Next pages. UI moved; API kept Nest paths:

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
- [x] Vercel Cron for automations
- [x] Remove Nest proxy rewrite from `next.config.ts`
- [x] Root `npm run dev` / `build` = web only
- [ ] Set Vercel env vars listed above
- [ ] Deploy & smoke-test production
- [ ] Delete Render service `agencyflow-api`
- [ ] Optional later: delete or archive `apps/api` Nest app (keep `prisma/` + seed)

## Legacy

`apps/api` Nest codebase remains for Prisma migrations/seed (`npm run db:migrate`, `db:seed`) until those scripts are moved into `apps/web`. It is **not** needed to run the product.
