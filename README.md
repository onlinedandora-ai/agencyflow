# AgencyFlow

End-to-end agency operations platform — replaces Zoho CRM, Zoho Projects, Zoho Books, and manual SOP tracking.

See [prd.md](./prd.md) for the full product requirements document.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, TanStack Query |
| Backend | NestJS, Prisma, PostgreSQL |
| Cache/Queue | Redis (ready for BullMQ automation engine) |

## Quick start

### 1. Start database

```bash
npm run db:up
```

### 2. Migrate & seed

```bash
npm run db:migrate
npm run db:seed
```

### 3. Run dev servers

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agencyflow.com | demo123 |
| Client Manager | manager@agencyflow.com | demo123 |

## MVP progress (Phase 1 started)

- [x] Monorepo scaffold (`apps/web`, `apps/api`)
- [x] PostgreSQL schema (users, leads, workspaces, projects, tasks, invoices)
- [x] JWT auth with role model
- [x] CRM lead pipeline with 30-minute SLA tracking
- [x] Kanban pipeline UI
- [x] Discovery call sheet (10-question form)
- [x] Proposal builder (6 sections, 300-word guardrail, 24h timer, case studies)
- [x] Client onboarding with advance-payment gate
- [ ] Task boards by service line
- [ ] Invoicing + payment automation

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
