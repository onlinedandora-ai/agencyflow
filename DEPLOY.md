# Production deploy checklist

> **Current stack:** Firebase App Hosting / Cloud Run (Next.js UI + API) + Supabase / Cloud SQL (Postgres).  
> **Render Nest API is retired** — see [MIGRATION.md](./MIGRATION.md).

## Production setup

| Service | Project | URL | Deploy |
|---------|---------|-----|--------|
| **App (UI + API)** | Vercel `agencyflow` | https://agencyflow-dandora-team.vercel.app | Git push `main` |
| **DB** | Supabase / Cloud SQL | Singapore pooler | `npm run db:migrate` / seed |

**Vercel Setup**

- Project: `agencyflow` (Team: `dandora-team`)
- Root directory: `apps/web`
- Branch: `main`
- Production URL: https://agencyflow-dandora-team.vercel.app

## Standard workflow

```bash
git add -A && git commit -m "Your message"
git push origin main
```

Firebase automatically builds and serves the full app (pages + Route Handlers + crons).

## Required environment variables

```
DATABASE_URL=<Supabase pooler URL — no quotes>
DIRECT_URL=<Supabase session/direct URL — no quotes>
JWT_SECRET=<long random string>
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase Web API Key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ajencyflow.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ajencyflow
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ajencyflow.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=335519498043
NEXT_PUBLIC_FIREBASE_APP_ID=1:335519498043:web:b20d19a59ac87d7fa4811e
RAZORPAY_KEY_ID=<optional>
RAZORPAY_KEY_SECRET=<optional>
CRON_SECRET=<random string for cron auth>
```

Leave `NEXT_PUBLIC_API_URL` **unset** so the browser uses same-origin `/…` API routes.

## Local

```bash
# apps/web/.env.local
npm run db:generate
npm run dev
```

## DB migrations / seed

Prisma schema lives under `apps/api/prisma`:

```bash
npm run db:migrate
npm run db:seed
```

## Verify

- [ ] `GET https://ajencyflow.web.app/health` → `{"status":"ok","runtime":"next",…}`
- [ ] Login with Google or `admin@agencyflow.com` / `demo123`
- [ ] Pipeline loads; archive works
- [ ] Project board loads
- [ ] (Optional) Razorpay portal payment with live keys
