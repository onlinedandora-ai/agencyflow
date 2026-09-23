# AgencyFlow — Google Stitch UI Design & Building Specification
> **Target Framework:** Next.js 16 + Tailwind CSS v4 + React 19 + Shadcn/Base-UI  
> **Aesthetic Profile:** Modern High-End Glassmorphism, Deep Slate/Indigo Mesh Gradients, Clean Dashboard Architecture, Micro-Interactions  
> **Primary Use:** Feed this specification directly into Google Stitch or Stitch AI design tools to generate, customize, and iterate on pixel-perfect AgencyFlow UI screens.

---

## 1. System & Brand Overview

AgencyFlow is a premier operations operating system for creative and digital agencies (by SreeDrisya Media). It consolidates lead management, SLA tracking, discovery calls, 300-word proposal creation, multi-step client onboarding, project execution with internal QA gates, deliverable client approvals, and milestone invoicing with Razorpay into an integrated, elegant interface.

### Brand Identity & Aesthetic Pillars
1. **Ultra-Clean Frosted Glassmorphism**: Translucent floating cards (`backdrop-blur-2xl` to `backdrop-blur-3xl`, `bg-white/60` to `bg-white/78`, `border-white/50`) over a subtle, animated radial mesh background.
2. **High-Contrast Dark Glass Sidebar**: Deep slate sidebar (`bg-slate-950/70`, `border-r-white/10`) providing grounding contrast for light workspace cards.
3. **Information Density & Scannability**: Compact stat tiles, Zoho CRM-style stage chip selectors, Amazon/Flipkart-style 2-column mobile cards, and drag-and-drop Kanban boards with clear visual indicators for SLA countdowns and quality gates.
4. **Zero-Fluff Feedback**: Micro-animations on hover, real-time SLA breach countdowns, gate locks, and responsive dialogs/sheets.

---

## 2. Design Tokens & Visual Architecture

### 2.1 Color Palette
```css
/* Core Brand & Accents */
--color-primary: #4f46e5;            /* Indigo 600 - Main actions, active tabs */
--color-accent: #06b6d4;             /* Cyan 500 - Highlights & secondary gradients */
--color-ink: #0f172a;                /* Slate 900 - Primary text */
--color-muted: #64748b;              /* Slate 500 - Secondary text */

/* Surface & Glass Levels */
--color-bg: #e8edf5;                 /* Soft cool slate background */
--color-surface: rgba(255, 255, 255, 0.65);
--color-surface-hover: rgba(255, 255, 255, 0.85);
--color-border-glass: rgba(255, 255, 255, 0.50);

/* Semantic Indicators */
--color-success: #16a34a;            /* Green 600 - Won, Paid, QA Approved */
--color-warning: #f59e0b;            /* Amber 500 - SLA At Risk, Pending QA */
--color-danger: #dc2626;             /* Red 600 - SLA Breached, Overdue, Gate Locked */
--color-info: #0284c7;               /* Sky 600 - Sent, In Progress */

/* Dark Glass Sidebar */
--sidebar-bg: rgba(15, 23, 42, 0.75); /* Slate 950 @ 75% */
--sidebar-border: rgba(255, 255, 255, 0.10);
--sidebar-text: #ffffff;
--sidebar-text-muted: rgba(255, 255, 255, 0.60);
--sidebar-item-active: rgba(255, 255, 255, 0.12);
```

### 2.2 Background Mesh Gradient
```css
body {
  background-color: #e8edf5;
  background-image:
    radial-gradient(ellipse 80% 60% at 10% -10%, rgba(99, 102, 241, 0.22), transparent 55%),
    radial-gradient(ellipse 70% 55% at 95% 5%, rgba(6, 182, 212, 0.16), transparent 50%),
    radial-gradient(ellipse 60% 50% at 50% 100%, rgba(139, 92, 246, 0.12), transparent 55%);
  background-attachment: fixed;
}
```

### 2.3 Typography & Sizing
- **Font Family**: Inter, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
- **Headings**:
  - `H1` (Page Title): `text-2xl sm:text-3xl font-semibold tracking-tight`
  - `H2` (Section Title): `text-lg sm:text-xl font-semibold`
  - `H3` (Card Header): `text-sm sm:text-base font-medium text-slate-800`
- **Body**: `text-sm text-slate-700 leading-relaxed`
- **Meta / Captions**: `text-xs text-muted-foreground`
- **Stat Values**: `text-xl sm:text-2xl font-semibold tracking-tight text-slate-900`

### 2.4 Component Shape & Elevation
- **Card Corners**: `rounded-2xl` (16px)
- **Button / Input Corners**: `rounded-xl` (12px)
- **Badges / Chips**: `rounded-full` (9999px)
- **Glass Shadows**: `shadow-xl shadow-black/[0.04]` to `shadow-2xl shadow-black/[0.06]`
- **Backdrop Filters**: `backdrop-blur-2xl` (24px) for cards, `backdrop-blur-3xl` for sheets and dialogs

---

## 3. Global Layout & Shell Architecture

### 3.1 Desktop Shell (`lg:min-w-screen`)
- **Left Fixed Glass Sidebar** (`w-64`, `bg-slate-950/70`, `backdrop-blur-3xl`):
  - Brand Header: "AgencyFlow" with subtitle "by SreeDrisya Media"
  - Expandable **Sales** group (Proposals, Invoices)
  - Navigation links with Lucide icons:
    - Pipeline (`Users`), Clients (`Briefcase`), Projects (`Kanban`), Dashboard (`LayoutDashboard`), Reports (`BarChart3`), Settings (`Settings`)
- **Main Viewport Area**:
  - Top Glass Header: User info pill ("Signed in as [Name]", Role Badge), Sign out button, and Mobile Hamburger trigger
  - Content Zone: `p-4 sm:p-6`, dynamic layout area.

### 3.2 Mobile Navigation (`< lg`)
- Top sticky glass bar with hamburger icon.
- Slide-over Glass Sheet (`w-[min(18rem,88vw)]`) with backdrop blur.
- Responsive 2-column card grid layouts for quick thumb navigation.

---

## 4. Screen-by-Screen UI Specifications

### Screen 1: Lead Pipeline & CRM Kanban (`/pipeline`)
*Primary purpose: Real-time lead capture, SLA breach monitoring, and drag-and-drop pipeline progression.*

#### UI Components & Sections:
1. **Summary Stat Strip (4-column grid on desktop, 2-column on mobile)**:
   - *Total Leads*: Count + total active pipeline
   - *Closed Won*: Count + total won revenue
   - *Conversion Rate*: Percentage conversion
   - *SLA Breaches*: Red alert badge if > 0 with pulse indicator
2. **Stage Chip Bar (Quick filtering & mobile-friendly stage selector)**:
   - Chips: `All`, `New`, `Contacted`, `Discovery`, `Proposal`, `Negotiation`, `Won`, `Lost`, `Nurture`
3. **Kanban Board (Horizontal scrolling / drag-and-drop columns)**:
   - Column Header: Stage name, lead counter badge, colored accent top border
   - **Lead Card Item**:
     - Contact name (bold) & Company name
     - Source tag (e.g. `Meta Ads`, `Referral`, `Website`, `Cold Outreach`)
     - **30-Minute SLA Pill**:
       - *Normal*: Green clock icon + "XXm remaining"
       - *Near Breach (<= 10 min)*: Amber clock + "Urgent: XXm"
       - *Breached*: Red alert triangle + "SLA Breached"
     - Quick Action Button: "Log First Response" (one-click response logger)
     - Assigned team member avatar
     - Context Menu (`...`): Edit, Move Stage, Archive, Convert to Client
4. **Floating / Header Action**: `+ New Lead` button triggering glass dialog.

---

### Screen 2: Discovery Call Qualification (`/discovery`)
*Primary purpose: Structured 6-question qualification framework before proposal generation.*

#### UI Components & Sections:
1. **Lead Header Card**: Lead name, company, budget range, and scheduled date/time picker.
2. **Qualification Questionnaire (Clean accordion / vertical card deck)**:
   - `Q1: Core Problem & Goals`: Textarea for client pain points.
   - `Q2: Target Audience & ICP`: Customer profile inputs.
   - `Q3: Current Channels & Metrics`: Past performance & existing marketing assets.
   - `Q4: Scope & Key Deliverables`: Desired services selection tags.
   - `Q5: Budget & Timeline Expectation`: Investment bracket and launch deadline.
   - `Q6: Decision Makers & Stakeholders`: Approval hierarchy and sign-off contacts.
3. **Research Notes Panel**: Freeform rich notes for agency discovery team.
4. **Footer Action Bar**:
   - `Save Draft`, `Mark Discovery Complete`, `Generate 300-Word Proposal →`

---

### Screen 3: 300-Word Proposal Builder & History (`/proposals`)
*Primary purpose: Ultra-concise, high-conversion proposals strictly enforced to <= 300 words.*

#### UI Components & Sections:
1. **Live Word Count Meter**:
   - Dynamic counter badge (`245 / 300 words`)
   - Progress bar turning from Indigo (`< 280`) → Amber (`280-300`) → Red (`> 300 words - Exceeds limit`).
2. **Structured Proposal Sections (6-Part Framework)**:
   - **1. Current Situation & Challenge** (50 words)
   - **2. Core Recommendation & Strategy** (60 words)
   - **3. Scope & Key Deliverables** (70 words)
   - **4. Timeline & Milestones** (40 words)
   - **5. Commercial Investment & Payment Terms** (50 words)
   - **6. Immediate Next Step** (30 words)
3. **Case Study Attachment Selector**: Dropdown to link verified agency proof.
4. **Actions & Shareable Links**:
   - `Send Proposal (Email / WhatsApp Link)`
   - `Copy Public Client Portal URL` (Generates secure `/p/[token]` link)
   - `Preview Proposal Document` (Clean print/PDF layout)
5. **Version History & Revision Timeline**:
   - Version tabs (`v1.0`, `v1.1`, `v2.0`)
   - Log of client comments, revision requests, and timestamped acceptances.

---

### Screen 4: Public Client Proposal View (`/p/[token]`)
*Primary purpose: Minimal, distraction-free client acceptance page with branding.*

#### UI Components & Sections:
1. **Top Agency Brand Bar**: Agency Logo, Contact, and GSTIN info.
2. **Clean Paper Document Card (`proposal-document`)**:
   - Crisp white paper backdrop, elegant serif/sans typography, formatted sections.
3. **Acceptance Callout Box (Sticky Bottom / Card Footer)**:
   - Input: Signee Name & Official Email
   - Button: `Accept & Proceed to Onboarding (Instant Sign-off)`
   - Link: `Request Changes / Clarification` (Opens revision note modal)

---

### Screen 5: Client Workspace & 3-Step Intake Portal (`/portal/[token]`)
*Primary purpose: Zero-friction client onboarding and asset collection.*

#### UI Components & Sections:
1. **Onboarding Progress Stepper (3 Progress Steps)**:
   - `Step 1: Company & Billing Details` (GSTIN, PAN, Invoicing address, Contacts)
   - `Step 2: Brand Voice & Assets` (Logo uploads, Drive links, Tone of voice, Dos & Don'ts)
   - `Step 3: Platform Access & Credentials` (Ad accounts, Social handles, Tag Manager permissions)
2. **Interactive Form Panels**: Form validation, multi-file upload drops, and status badges (`Completed`, `Pending Client`).
3. **Advance Invoice & Payment Banner**:
   - Displays 50% Advance Invoice status with `Pay via Razorpay` or `Submit Bank Transfer UTR` action.

---

### Screen 6: Project Execution Board with QA Gates (`/projects/[id]`)
*Primary purpose: Task management with mandatory QA sign-offs, revision limits, and advance payment locks.*

#### UI Components & Sections:
1. **Gate Lock Alert (Conditional)**:
   - When Advance is unpaid: Bright Red Banner `🔒 Execution Gate Locked — Advance Invoice #INV-XXX Pending. Tasks cannot be moved to In Progress until payment is confirmed.`
2. **Service Line Board Template**:
   - Automatic column configurations (e.g. `Backlog` → `Briefing` → `In Progress` → `Internal QA Review` → `Client Review` → `Approved / Done`).
3. **Task Card**:
   - Task title, priority tag (`Urgent`, `High`, `Medium`), Due date.
   - **QA Sign-off Badge**: Green checkmark icon with reviewer name once signed off.
   - **Revision Round Pill**: `Round 1 of 2` (Warns `Billable Revision` if > 2 rounds).
   - SLA deadline counter.
4. **Task Detail Drawer**:
   - Description, custom field specs, assignee selector, QA sign-off button, Deliverable attachments.

---

### Screen 7: Deliverables & Client Feedback (`/deliverables`)
*Primary purpose: Internal sign-off, client sharing, and approval audit trails.*

#### UI Components & Sections:
1. **Deliverable Item Card**:
   - File thumbnail / Link icon, File name, Mime type, Version pill (`v2`).
   - Workflow Status Pill: `DRAFT` → `SUBMITTED_FOR_QA` → `QA_APPROVED` → `SHARED_WITH_CLIENT` → `CLIENT_APPROVED`.
2. **Actions**:
   - `Approve & Sign-off QA`, `Request Internal Edit`, `Generate Client Link`, `Record Client Approval`.

---

### Screen 8: Milestone Invoicing & Razorpay Billing (`/invoices`)
*Primary purpose: Professional tax invoices, 50-50 splits, Razorpay checkout, and manual UTR verification.*

#### UI Components & Sections:
1. **Invoicing Dashboard Top Strip**:
   - *Total Invoiced*, *Collected*, *Pending Due*, *Overdue*.
2. **Invoice Numbering System**:
   - Pro-forma Draft Invoice (`DRAFT-XXXX`) vs Final GST Tax Invoice (`INV-2026-XXXX`).
   - Official Payment Receipts (`REC-2026-XXXX`).
3. **Milestone Split Table (50-50 Advance & Final Delivery)**:
   - Milestone 1: `50% Project Advance` — Status: `Paid` / `Pending`
   - Milestone 2: `50% Final Project Delivery` — Status: `Pending`
4. **Payment Claim Review Drawer**:
   - Shows client-submitted Bank UTR / Screenshot proof with `Verify & Mark Paid` action.
5. **Razorpay Modal Trigger**: Direct payment gateway launch for credit card / UPI / Netbanking.

---

### Screen 9: Executive Reports & Analytics (`/reports`)
*Primary purpose: High-level visibility into agency velocity, conversion rates, and revenue health.*

#### UI Components & Sections:
1. **Pipeline Funnel Chart**: Drop-off rates from New → Discovery → Proposal → Won.
2. **Revenue Breakdown**: Collected vs Projected vs Overdue amount cards.
3. **Project Health Grid**: Live status of all ongoing projects (`Green`, `Yellow`, `Red`).
4. **Automation Engine Audit Log**: Table of background cron jobs (`lead_sla_scan`, `proposal_followup`, `invoice_overdue`).

---

## 5. Google Stitch AI Prompt Templates

Use these ready-to-use prompt templates inside Google Stitch to generate and iterate on each screen:

### Prompt 1: Full App Shell & Navigation
```text
Create a modern, luxury B2B SaaS application shell for "AgencyFlow" by SreeDrisya Media.
Design a dark glassmorphic fixed sidebar (rgba(15, 23, 42, 0.75) with backdrop-blur-3xl and white/10 border) containing an expandable "Sales" section (Proposals, Invoices) and navigation links (Pipeline, Clients, Projects, Dashboard, Reports, Settings).
The main content area should have a frosted glass header showing user info, a role badge, and a sign-out button, resting on a soft slate background with subtle multi-color radial gradient glows. All elements should have rounded-2xl corners, backdrop-blur-2xl, and crisp translucent borders.
```

### Prompt 2: Real-time Lead Pipeline Kanban with SLA Counters
```text
Generate a high-density Lead Management Kanban board for AgencyFlow.
Top section: 4 glass stat tiles displaying Total Leads, Won Leads, Conversion Rate (%), and SLA Breaches with an urgent red badge.
Sub-header: A horizontal scrollable bar with Zoho CRM-style stage chips (New, Contacted, Discovery, Proposal, Negotiation, Won, Lost, Nurture).
Board: 5 Kanban columns with glass panel styling. Each lead card inside should display the lead's name, company, marketing source tag, an interactive 30-minute SLA countdown timer pill (green when active, pulsing red when breached), and a quick-action "Log First Response" button. Include a "+ New Lead" glass button in the header.
```

### Prompt 3: 300-Word Proposal Generator & Version History
```text
Build a high-conversion 300-word proposal creation interface for digital agencies.
Top bar: Live word count meter badge showing "245 / 300 words" with an indicator progress bar that turns red if over 300 words.
Main layout: Two columns. Left column contains structured textareas for the 6-step proposal formula: 1. Situation, 2. Recommendation, 3. Deliverables, 4. Timeline, 5. Investment & Commercials, 6. Next Step.
Right column: A live document preview card formatted like a printed proposal, plus a version history timeline tab showing v1.0, v1.1, sent dates, and client revision request notes. Add buttons for "Send via Email/WhatsApp", "Copy Client Link", and "Preview PDF".
```

### Prompt 4: Project Board with Internal QA Gate and Milestone Locks
```text
Generate a project execution board for creative agencies.
At the top: Display a conditional red warning banner: "🔒 Execution Gate Locked — 50% Advance Payment Pending".
Columns: Backlog, In Progress, Internal QA Review, Client Approval, Done.
Cards: Tasks with priority tags, due dates, assignee avatar, and a "QA Signed Off" badge. Include a revision counter pill (e.g. "Round 1/2", flagging red if > 2 rounds as billable).
Provide a task details slide-over drawer with QA sign-off controls and deliverable file upload dropzones.
```

### Prompt 5: Milestone Invoicing & Razorpay Billing View
```text
Create a sleek agency invoicing and milestone billing dashboard.
Header: Metrics for Total Invoiced, Collected, and Overdue Amount in INR (₹).
Main content: Split milestone cards for 50% Advance and 50% Final Delivery. Each milestone includes amount, due date, status badge, and an integrated "Pay via Razorpay" button or "Submit Bank Transfer UTR" option.
Include a table of issued GST Tax Invoices (INV-2026-XXXX) and payment receipts with download PDF actions.
```

---

## 6. Responsive Breakpoint & Mobile Rules

| Breakpoint | Target Devices | Layout Behavior |
| :--- | :--- | :--- |
| `sm` (< 640px) | Mobile Phones (iPhone, Pixel) | 2-column stat grids (Amazon/Flipkart style), swipeable stage chips, bottom safe-area insets, mobile slide-over sheet. |
| `md` (640px - 1024px) | Tablets & iPad Pro | 2-column Kanban boards with horizontal scroll, compact data tables. |
| `lg` (1024px+) | Laptops & Desktops | Full fixed dark glass sidebar, multi-column Kanban boards, split proposal builder preview. |
| `xl` (1280px+) | Large Displays (1080p+) | 4-column metric tiles, expanded project timelines. |

---

## 7. Instructions for Google Stitch Integration
1. Open Google Stitch UI builder workspace.
2. Paste the **Design Tokens & Visual Architecture** (Section 2) into the Stitch Design System editor.
3. Use the **Google Stitch AI Prompt Templates** (Section 5) to generate each screen iteratively.
4. Export the resulting UI components into `apps/web/src/components/` and pages into `apps/web/src/app/`.
