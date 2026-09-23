# Product Requirements Document
## AgencyFlow — End-to-End Agency Operations Platform
### (Replaces Zoho CRM, Zoho Projects, Zoho Books, and manual SOP tracking)

**Version:** 2.0
**Status:** Draft for review
**Owner:** [Product Owner Name]
**Based on:** Dandora.online Operations Playbook v2.0 (June 2026)
**Last updated:** July 7, 2026

---

## 1. Overview

### 1.1 Problem Statement
The agency currently runs its entire operation — lead capture, discovery, proposals, onboarding, project delivery, invoicing, and vendor management — across Zoho CRM, Zoho Projects, Zoho Books, Zoho Mail, Google Drive/Forms, WhatsApp/AiSensy, Slack, and Razorpay, stitched together manually per a detailed SOP. This works but is fragmented: no single source of truth, manual handoffs between tools at every stage, and SOP compliance (30-minute lead response, advance-payment gating, revision-round limits) depends entirely on individual discipline rather than the system enforcing it.

### 1.2 Product Vision
One custom-built platform, owned end-to-end, that encodes the agency's actual SOP as software: a lead becomes a deal, a deal becomes a client workspace, a client workspace runs through service-line delivery with enforced payment gates and revision limits, and every follow-up sequence, reminder, and escalation the SOP currently relies on a human to remember is automated by the system itself.

### 1.3 Target Users
| Persona | Maps to SOP Role | Core Need |
|---|---|---|
| Agency Owner / Operations Lead | Level 1 — Admin/Ops Lead | Full visibility: pipeline, all clients, all invoices, all team workload, system configuration |
| Client Manager | Level 2 — Client Manager | Own the client relationship: communication, approvals, timeline, escalations |
| Delivery Team Member | Level 3 — Dandora Executive | Execute assigned deliverables, log time, flag blockers |
| Freelancer / Vendor Partner | External — Vendor | Scoped access to only their own assigned deliverables, nothing else |
| Client | External — Client | View progress, approve/reject deliverables, pay invoices — nothing internal |

### 1.4 Success Metrics
- 100% of leads get a logged first response within 30 minutes (system-tracked, not self-reported)
- Zero projects start creative/strategy work before advance payment is confirmed (system-enforced)
- Proposal turnaround stays under 24 hours from discovery call (system-timed)
- Revision rounds beyond the included 2 are automatically flagged and billed — zero missed billable revisions
- Late-payment follow-up sequence fires automatically at every SOP-defined interval (0, +3, +7, +14, +30 days) with zero manual tracking

---

## 2. Goals & Non-Goals

**Goals**
- Fully replace Zoho CRM, Zoho Projects, and Zoho Books with one custom system, own PostgreSQL database, no third-party SaaS dependency for core records
- Encode the full SOP lifecycle as system stages: Lead → Discovery → Proposal → Client Onboarding → Project Setup → Delivery → Invoicing, with automation at every handoff point defined in the SOP
- Enforce hard business rules the SOP currently relies on discipline for: 30-minute response SLA tracking, advance-payment gate before work starts, 2-included-revision limit with automatic overage billing, escalation paths
- Three-tier + vendor access model matching the SOP's actual org structure (Section 4)
- Built-in workflow automation engine for follow-up sequences, reminders, and nurture broadcasts (replacing AiSensy/Zoho task automation)
- Native invoicing with GST-compliant invoices, payment gateway integration, and automated payment follow-up
- Native file storage (replacing Google Drive as system of record, with optional external linking)

**Non-Goals (v1)**
- Native mobile apps (responsive web only in v1)
- Built-in video conferencing
- Full accounting/bookkeeping/tax filing (invoicing and payment tracking only — export to accountant/CA, not a books-of-account replacement)
- Native offline mode
- Custom domain email hosting (continue using existing email provider; system sends transactional/automation email via API)

---

## 3. Core Features

### 3.1 CRM & Lead Pipeline *(new — replaces Zoho CRM)*
- Lead capture from any source (referral, web form, WhatsApp, manual entry) logged to one pipeline
- Pipeline stages matching SOP exactly: **New → Contacted → Discovery Scheduled → Proposal Sent → Negotiation → Closed Won / Closed Lost**
- SLA timer on every new lead — visual + notification escalation if first response isn't logged within 30 minutes
- Automated no-reply follow-up sequence engine (Day 1, 2, 5, 10, 30+ per SOP-01) with configurable message templates per channel (WhatsApp/Email)
- "Nurture" status after 4 unanswered follow-ups — monthly broadcast only, with unsubscribe, lead never deleted, reactivates instantly on reply
- Discovery call workspace: pre-call research checklist, the 10-question discovery sheet as a structured form (not free text), call notes tied to the lead record
- One-click conversion: Lead → Contact + Account → Client Workspace on Closed Won

### 3.2 Proposal Builder *(new)*
- Structured 6-section proposal template (Situation, Recommendation, Deliverables, Timeline, Investment, Next Step) per SOP-03-A
- Word-count guardrail (SOP requires under 300 words) with a soft warning
- Pilot-project attachment picker (pull from a reusable case-study library)
- Proposal sent → 24-hour countdown visible to the assigned rep
- Automated follow-up sequence (same day, +48h, +5d, +10d, +30d) per SOP-03-B, same nurture-after-no-reply logic as leads

### 3.3 Client Onboarding *(new — encodes SOP Chapter 04)*
- "Client says yes" trigger kicks off a checklist workflow: welcome message, team assignment, WhatsApp/comms group creation, CRM conversion, first invoice raised, project created, requirements frozen
- **Advance payment gate**: project status is locked at "Awaiting Advance" — no task can be marked in-progress by any Member or Vendor role until the system detects the advance invoice is paid
- Frozen Requirements document: scope, deliverables, timeline, and pricing locked and versioned once client signs off — any change after this point must go through the Change Request flow (Section 3.4)
- Client Intake Form (structured, replacing Google Forms) — assets, credentials (stored securely, never in chat/plaintext), references, approvals contacts
- Kickoff call scheduler with structured agenda template

### 3.4 Workspace Architecture & Change Control
- **Agency workspace** → **Client workspaces** (isolated) → **Projects** → **Tasks**
- Client workspace templates by service line (Web Dev, Digital Marketing, Content Creation, Ad Management)
- **Change Request flow**: any scope change after requirements freeze must route Client Manager → Admin → Approval before any task is added/modified — logged as an auditable change order, distinct from normal task edits

### 3.5 Task Management
- Tasks: title, rich-text description, assignee(s), due date, priority, status, tags, attachments, linked client/project
- Subtasks, checklists, dependencies, recurring tasks (for retainers: weekly reports, monthly content batches)
- Custom fields per service line (Repo link/Environment for Dev; Channel/Campaign/Budget for Marketing; Content type/Platform/Publish date for Content; Platform/Budget/ROAS target for Ads)

### 3.6 Service-Line Workflow Templates
| Service Line | Board Columns | Key Custom Fields |
|---|---|---|
| Web Development | Backlog → Design → Dev → QA → Client Review → Live | Repo link, Environment, Bug severity |
| Digital Marketing | Strategy → In Progress → Client Approval → Scheduled → Live → Reporting | Channel, Campaign, Budget |
| Content Creation | Brief → Draft → Internal Review → Client Review → Approved → Published | Content type, Platform, Publish date |
| Ad Management | Planning → Creative Build → Client Approval → Live → Optimizing → Reporting | Platform, Budget, ROAS target |

### 3.7 Delivery, Review & Revision Tracking *(encodes SOP Chapter 07)*
- Delivery checklist enforced before a task can move to "Client Review": internal peer QA sign-off required first (matches SOP's "second team member review" rule)
- Structured delivery message with Drive-equivalent link, key decisions, feedback deadline — no attachment-via-chat pattern
- **Revision round counter** per deliverable: Round 1 (full draft) and Round 2 (revision) included in fee; Round 3+ automatically flagged as billable and routed to invoicing at the agreed hourly rate, with a quote-before-starting confirmation step
- Written final approval capture (in-app e-sign/confirm — not just a chat message) required before final invoice is triggered

### 3.8 Invoicing & Payments *(new — replaces Zoho Books)*
- Payment term templates matching SOP-06-A exactly: One-time (50/50), Large project ₹3L+ (40/30/30), Retainer (100% on 1st), Consulting (50/50)
- GST-compliant invoice generation: company GSTIN, client GSTIN, itemized scope, bank details, due date, automatic late-fee clause (2%/week)
- Payment gateway integration for online collection (UPI/cards/netbanking)
- **Automated late-payment sequence** per SOP-06-B: due-date auto-reminder → +3 days personal WhatsApp-style nudge → +7 days firm notice → +14 days auto-pause on project delivery (blocks task progress, same mechanism as the advance-payment gate) → +30 days formal notice flag for Admin
- Revenue/collections dashboard: outstanding, overdue, upcoming milestones, per-client and agency-wide

### 3.9 Vendor & Freelancer Management *(new — encodes SOP-05-C)*
- Vendor profile: name, GST/PAN, bank details, rate card, expertise, turnaround time, quality standard notes
- Vendor agreement tracking (deliverables, timelines, revision limits, payment terms, NDA status) stored against the vendor record
- Scoped access: a vendor sees only their assigned tasks and their specific deliverables folder — no visibility into the client's full workspace, CRM, or invoicing
- Vendor task assignment tagged "Freelance"/"Partner" with expected delivery date, distinct from internal team assignment

### 3.10 Internal Systems Setup Automation *(encodes SOP-05-A)*
- On advance-payment confirmation, system auto-generates: client folder structure (Assets/Deliverables/Approvals/Internal), access permissions per role, and a task-derivation workspace to break the frozen requirements into a task list — collapsing what SOP-05-A currently requires a human to do manually within 24 hours

### 3.11 Collaboration
- Threaded comments, @mentions (internal-only by default; explicitly mark client-visible)
- Real-time presence
- File attachments with version history for creative assets
- Client-facing approval screen: Approve / Request Changes with comment, tied into the revision-round counter (3.7)
- Activity feed / audit log per task and project

### 3.12 Notifications & Workflow Automation Engine *(new — replaces AiSensy + Zoho task reminders)*
- Rule-based automation engine underlying every sequence in this PRD: lead follow-ups, proposal follow-ups, payment reminders, nurture broadcasts, SLA escalations
- Configurable trigger → wait → action chains (e.g., "if no reply after 24h, send message X, assign follow-up task to Y")
- Channels: in-app, email, WhatsApp Business Cloud API, Slack
- Escalation path automation matching SOP-05-B: Client Manager → Admin/Owner, triggered on flagged delays or client-reported issues

### 3.13 Reporting & Dashboards
- **Pipeline dashboard**: leads by stage, conversion rate, average response time, SLA breaches
- **Per-client dashboard** (shareable): project status, milestones, deliverable approval status
- **Agency-wide portfolio dashboard** (internal-only): all clients, at-risk projects, overdue tasks, team utilization, revenue/collections
- **Workload/resourcing view**: tasks per person across all clients, capacity, overallocation flags
- Ad performance snapshot via Meta/Google Ads API integration
- Custom report builder, exportable (CSV/PDF), internal vs. client-safe modes

### 3.14 Time Tracking
- Manual/timer logging per task, tagged to client, service line, and billable/non-billable (for revision-overage billing)
- Timesheet reports per user/client/service line for retainer utilization and profitability

### 3.15 Search
- Global search across leads, clients, tasks, comments, files — scoped by role (internal roles: agency-wide; Client/Vendor: their own workspace only)

### 3.16 Admin & Settings
- Agency branding; per-client portal branding option
- Full audit log (every stage transition, payment gate override, access change)
- User and role management, SOP template/checklist editor (so playbook updates don't require a code change)

---

## 4. User Roles — Access Model

Matches the SOP's actual structure: a 3-level internal hierarchy plus two distinct external access types.

### Tier 1 — Admin (Operations Lead / Agency Owner)
Full agency-wide control. Owns systems, access, infrastructure, vendor onboarding approval, financial visibility, and final escalation point. Can act as any role on any project when needed.

### Tier 2 — Member (internal team, two sub-roles)
**2a. Client Manager** — owns the client relationship: primary contact, weekly status updates, collects approvals, manages timeline/scope, escalates issues, coordinates between client and delivery team. Scoped to assigned clients only.

**2b. Delivery Executive** — creative/strategy/dev execution, internal peer QA, incorporates feedback, logs time, escalates blockers. Scoped to assigned tasks/clients only.

*(Both sub-roles share the Member permission floor — task CRUD within assigned clients, no cross-client visibility, no billing/CRM-pipeline-wide access — and differ only in which actions the UI surfaces by default.)*

### Tier 3 — External (two distinct types, both outside the agency)
**3a. Client** — view their own workspace, approve/reject deliverables, pay invoices, upload briefs/references. No visibility into internal comments, other clients, agency costs, vendor identities, or timesheets.

**3b. Vendor / Freelancer** — view and update only their specifically assigned tasks and their own deliverables folder. No visibility into the client's full workspace, CRM record, pricing, or invoicing — even more restricted than Client access, since vendors shouldn't see client-side commercial terms.

| Capability | Admin | Client Manager | Delivery Exec | Client | Vendor |
|---|:---:|:---:|:---:|:---:|:---:|
| Cross-client / pipeline dashboard | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage leads & proposals | ✅ | ✅ (assigned) | ❌ | ❌ | ❌ |
| Create/manage client workspaces | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit/assign tasks | ✅ | ✅ (assigned clients) | Own tasks only | ❌ | Own tasks only |
| View internal comments | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve/reject deliverables | N/A | N/A | N/A | ✅ | N/A |
| View/raise invoices | ✅ | View only (assigned) | ❌ | View + pay own | ❌ |
| View timesheets/costs | ✅ | Own clients | Own entries | ❌ | Own entries |
| Vendor management | ✅ | Request only | ❌ | ❌ | N/A |
| Override payment/advance gate | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 5. User Flows (Key)

1. **Lead comes in** → auto-logged → 30-min SLA timer starts → rep responds → CRM stage moves to Contacted → Discovery Call booked → 10-question sheet filled during call → Proposal drafted from template → sent → follow-up sequence auto-runs → Closed Won → converts to Client Workspace
2. **Client says yes** → welcome sequence fires → advance invoice auto-generated → project locked at "Awaiting Advance" → payment confirmed → gate lifts → folder structure + task list auto-generated → kickoff scheduled
3. **Delivery Executive finishes a draft** → internal peer QA required before "Client Review" → client approves or requests changes → Round 2 revision applied → client approves → written sign-off captured → final invoice triggered
4. **Client misses invoice due date** → auto-reminder day 0 → personal nudge +3d → firm notice +7d → project auto-pauses +14d (blocks Delivery Exec/Vendor task actions) → Admin gets formal-notice flag +30d
5. **Vendor assigned a deliverable** → sees only that task and its folder → uploads work → Client Manager reviews → client never sees vendor identity unless the agency chooses to disclose it
6. **Admin reviews portfolio dashboard** → filters "at risk" (SLA breach, overdue, unpaid) → intervenes directly

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Data isolation | Strict tenant-style isolation between client workspaces, enforced at the API/query layer |
| Data ownership | 100% owned data — no reliance on Zoho or any third-party CRM/PM/invoicing platform for system of record |
| Performance | Task board with 500+ items loads in <2s; interactions <150ms |
| Availability | 99.9% uptime SLA — this system now runs sales, delivery, and billing, so downtime has direct revenue impact |
| Scalability | Support 100+ concurrent client workspaces without cross-workspace performance impact |
| Security | Encryption at rest and in transit; strict RBAC; secure credential storage for client intake (secrets vault, not plaintext fields); SOC 2 readiness |
| Auditability | Every gate override (advance payment, revision limit, change request) logged with actor, timestamp, reason |
| Accessibility | WCAG 2.1 AA compliant |
| Browser Support | Latest 2 versions of Chrome, Firefox, Safari, Edge |
| Responsiveness | Fully usable on tablet (768px+); degrade gracefully on mobile web |
| Localization | English at launch; INR-first currency/GST formatting |

---

## 7. Required Tools & Tech Stack

### 7.1 Frontend
| Purpose | Tool |
|---|---|
| Framework | React (Next.js) |
| Language | TypeScript |
| State management | Zustand or Redux Toolkit |
| Data fetching / caching | TanStack Query |
| Styling | Tailwind CSS |
| Component library base | Radix UI / shadcn/ui |
| Drag-and-drop (board, Gantt) | dnd-kit |
| Charts/dashboards | Recharts or D3.js |
| Gantt/timeline rendering | Frappe Gantt or custom SVG/D3 |
| Rich text editor | Tiptap |
| Forms & validation | React Hook Form + Zod |
| Real-time client | Socket.IO client or Pusher/Ably SDK |

### 7.2 Backend
| Purpose | Tool |
|---|---|
| Runtime | Node.js |
| Framework | NestJS (structured, suits multi-module CRM + PM + billing domain) |
| API style | REST + GraphQL for complex cross-entity dashboard queries |
| Real-time server | Socket.IO or Ably/Pusher |
| Auth | Clerk / Auth0, or custom JWT + OAuth2 (Google/Microsoft SSO) |
| Background jobs / queues | BullMQ (Redis-backed) — powers every SOP automation sequence |
| Workflow/automation engine | Custom rule engine on BullMQ, or Temporal.io if sequence reliability at scale becomes critical |
| File storage | AWS S3 / Cloudflare R2 — replaces Google Drive as system of record |
| Search | PostgreSQL full-text (v1) → Meilisearch/Elasticsearch (scale) |
| Transactional email | Postmark or SendGrid |
| Secrets/credentials vault | HashiCorp Vault or AWS Secrets Manager (for client intake credentials) |

### 7.3 Data Layer
| Purpose | Tool |
|---|---|
| Primary database | PostgreSQL (row-level security / schema-per-tenant for client isolation) |
| ORM | Prisma |
| Caching | Redis |
| File/object storage | S3-compatible bucket, folder-scoped per client workspace |

### 7.4 Infrastructure / DevOps
| Purpose | Tool |
|---|---|
| Hosting (frontend) | Firebase App Hosting / Cloud Run |
| Hosting (backend) | AWS (ECS/Fargate) or Railway/Render for early stage |
| CI/CD | GitHub Actions |
| Containerization | Docker |
| Monitoring / error tracking | Sentry |
| Product analytics | PostHog or Mixpanel |
| Logging | Datadog or Grafana + Loki |
| Infra as code | Terraform (post-MVP) |

### 7.5 Payments & Communications (external rails, not systems of record)
| Purpose | Tool |
|---|---|
| Payment collection | Razorpay API (payment rail only — invoice record itself lives in-house, not Zoho Books) |
| WhatsApp automation | WhatsApp Business Cloud API (Meta) — direct integration, replacing AiSensy |
| Team chat notifications | Slack API |
| Ad performance sync | Meta Marketing API, Google Ads API |
| Calendar sync | Google Calendar / Outlook Calendar API (kickoff calls, publish dates) |

### 7.6 Testing & QA
| Purpose | Tool |
|---|---|
| Unit testing | Jest / Vitest |
| E2E testing | Playwright |
| API testing | Postman/Newman or Vitest + Supertest |
| Accessibility testing | axe-core |
| Multi-tenant isolation testing | Dedicated suite verifying no cross-client data leakage on every endpoint |
| Automation sequence testing | Time-travel/simulated-clock tests for every SLA and follow-up sequence (30-min response, day 1/2/5/10/30 follow-ups, payment reminders) |

---

## 8. Design System & Styles

### 8.1 Design Principles
- Clarity over density; instant feedback (optimistic UI)
- Two visual modes: data-rich internal interface vs. calmer, simplified Client/Vendor portal
- White-label ready: client portal supports client logo/accent color without breaking core layout

### 8.2 Color Palette
| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | #4F46E5 (indigo) | Primary actions, active states, links |
| `--color-accent` | #06B6D4 (cyan) | Highlights, progress, secondary CTAs |
| `--color-ink` | #0B1020 | Primary text, headers |
| `--color-surface` | #FFFFFF | Card/panel backgrounds |
| `--color-bg` | #F7F8FA | App background |
| `--color-border` | #E5E7EB | Dividers, input borders |
| `--color-success` | #16A34A | Completed, approved, paid |
| `--color-warning` | #F59E0B | Due-soon, pending approval, SLA at risk |
| `--color-danger` | #DC2626 | Overdue, blocked, gate not cleared, rejected |
| `--color-muted` | #6B7280 | Secondary text, metadata |

*Swap to house brand tokens if the agency's own identity differs; client portal accent color can override `--color-primary` per client view only.*

### 8.3 Typography
| Role | Typeface | Notes |
|---|---|---|
| Headings | Fraunces (serif) | Page titles, section headers |
| Body / UI | Poppins | All body text, labels, buttons |
| Monospace | JetBrains Mono | IDs, dev tasks, invoice/audit timestamps |

Type scale (base 16px): H1 32/40/600 · H2 24/32/600 · H3 18/26/600 · Body 14–16/22/400 · Caption 12/16/400–500

### 8.4 Spacing & Layout
- 8px base grid (4px micro-adjustments)
- Max content width: 1280px internal dashboards, 960px client/vendor portal
- Card radius 12px; buttons/inputs 8px
- Subtle elevation only (`0 1px 2px rgba(0,0,0,0.06)`)

### 8.5 Component Style Guidelines
- One solid primary button per view max
- Status/pipeline badges: pill-shaped, consistent color vocabulary from CRM stage through delivery status through invoice status
- Gate indicators: a distinct locked/blocked visual state (e.g., a lock icon + muted card) for tasks blocked by advance-payment or overdue-invoice gates — must be unmistakable, not just a color change
- Revision-round indicator on every deliverable card ("Round 1 of 2 included")
- Avatars: circular, initials fallback, stacked overlap
- Empty states: icon + one-line guidance + primary action
- Loading states: skeleton loaders, no bare spinners over 1s
- Dark mode: internal interface only (v1.1); client/vendor portal stays light-mode

### 8.6 Iconography
- Lucide icon set

---

## 9. Release Plan (Phased)

| Phase | Scope | Target |
|---|---|---|
| MVP (v1.0) | CRM/lead pipeline, discovery + proposal builder, client onboarding with advance-payment gate, workspace architecture, 3-tier + vendor roles, task management, List/Board views, delivery + revision-round tracking, basic invoicing | 4–5 months |
| v1.1 | Full automation engine (all SOP follow-up sequences), late-payment automation, Gantt/timeline view, time tracking, WhatsApp Business API + Slack integration | +8 weeks |
| v1.2 | Vendor portal, calendar view, ad platform integrations, report builder, portfolio/pipeline dashboard | +8 weeks |
| v2.0 | Mobile app, white-label client portal branding, SOP template editor for non-technical admins, SSO/SAML | Future |

---

## 10. Open Questions
- Credential storage for client intake (passwords, API keys) — confirm secrets-vault approach meets internal security comfort level before build
- Does the advance-payment gate need an Admin override path for trusted long-term clients, or should it be absolute for everyone including Admin?
- Should vendors ever see client names, or should the system support fully anonymized vendor assignment?
- Migration plan: how much historical CRM/Projects/Books data from Zoho needs to be imported vs. starting fresh?
- Who owns SOP template edits post-launch — hardcoded by engineering, or exposed as an admin-configurable workflow builder from day one?

---

## 11. Appendix
- Source SOP: Dandora.online Updated Operations Playbook, Version 2.0, June 2026 (Chapters 01–07: Lead Capture, Discovery Call, Proposals, Client Onboarding, Project Setup & Internal Systems, Invoicing & Payments, Project Delivery)
- Competitive references: Asana, Monday.com, ClickUp, HubSpot (CRM side), Function Point (agency-specific PM+billing)
- Glossary: *Gate* = a system-enforced block preventing task/delivery progress until a condition (payment, sign-off) is met · *Tier* = access level (Admin / Member / External) · *Sub-role* = Client Manager or Delivery Executive within Member tier · *Vendor* = external freelancer/partner, distinct from Client
