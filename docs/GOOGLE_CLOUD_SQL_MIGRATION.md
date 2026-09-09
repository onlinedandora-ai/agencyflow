# Google Cloud SQL (PostgreSQL) Migration Guide

This guide details how to transition AgencyFlow's PostgreSQL database from external providers (like Supabase) into the **Google Cloud Family** using **Google Cloud SQL for PostgreSQL**, integrated with **Firebase App Hosting**.

---

## 1. Why Google Cloud SQL for PostgreSQL?

AgencyFlow relies on Prisma ORM with over 25 relational models, multi-level joins, transactional consistency, foreign key constraints, and enum types. Google Cloud SQL for PostgreSQL provides:
- **100% Native Compatibility** with the existing Prisma schema (no schema rewrites or data loss).
- **Direct Integration with Firebase App Hosting & Cloud Run** via Unix sockets or private VPC connections without egress latency.
- **Enterprise-grade Backups, High Availability, and Point-in-time Recovery** inside your Google Cloud project (`quickfresh-10mins`).

---

## 2. Setting Up Cloud SQL in Google Cloud / Firebase

### Option A: Using Google Cloud Console
1. Open the [Google Cloud SQL Console](https://console.cloud.google.com/sql/instances) under project **`quickfresh-10mins`**.
2. Click **Create Instance** → Choose **PostgreSQL** (version 15 or 16).
3. Set:
   - **Instance ID**: e.g., `agencyflow-db`
   - **Password**: Secure root password
   - **Region**: Choose the same region as your Firebase App Hosting app (e.g., `asia-south1` or `us-central1`).
   - **Configuration**: "Enterprise" or "Sandbox/Shared core" (e.g. `db-f1-micro` or `db-g1-small` for low cost dev/testing).
4. Under **Databases**, create a database named `agencyflow`.
5. Under **Users**, create a user `agencyflow_app` with a secure password.

### Option B: Using Google Cloud CLI (`gcloud`)
```bash
# Create PostgreSQL instance
gcloud sql instances create agencyflow-db \
    --project=quickfresh-10mins \
    --database-version=POSTGRES_16 \
    --tier=db-custom-1-3840 \
    --region=asia-south1

# Create database
gcloud sql databases create agencyflow --instance=agencyflow-db --project=quickfresh-10mins

# Create user
gcloud sql users create agencyflow_user --instance=agencyflow-db --project=quickfresh-10mins --password=YOUR_PASSWORD
```

---

## 3. Connecting to Cloud SQL

### For Local Development (via Cloud SQL Auth Proxy)
The [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy) allows secure local access without needing to allowlist IP addresses:

1. Download `cloud-sql-proxy` for Windows or run:
   ```bash
   cloud-sql-proxy quickfresh-10mins:asia-south1:agencyflow-db --port 5432
   ```
2. Set your `apps/web/.env.local`:
   ```env
   DATABASE_URL="postgresql://agencyflow_user:YOUR_PASSWORD@127.0.0.1:5432/agencyflow?schema=public"
   DIRECT_URL="postgresql://agencyflow_user:YOUR_PASSWORD@127.0.0.1:5432/agencyflow?schema=public"
   ```

### For Firebase App Hosting / Cloud Run
Firebase App Hosting runs on Google Cloud Run. In `apphosting.yaml`:
```yaml
runConfig:
  minInstances: 0
  maxInstances: 5
  concurrency: 80
  cpu: 1
  memoryMiB: 1024

env:
  - variable: DATABASE_URL
    secret: DATABASE_URL
```
And store the connection string in Google Secret Manager or Cloud SQL socket format:
```
postgresql://agencyflow_user:YOUR_PASSWORD@/agencyflow?host=/cloudsql/quickfresh-10mins:asia-south1:agencyflow-db
```

---

## 4. Migrating Data from Supabase to Cloud SQL

Use the included helper script:
```powershell
./scripts/export-supabase-to-cloudsql.ps1 `
  -SourceUrl "postgresql://postgres.nwxshrpsunitweeoiuvy:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" `
  -TargetUrl "postgresql://agencyflow_user:PASSWORD@127.0.0.1:5432/agencyflow"
```

Or run Prisma migrations on the new database:
```bash
npm run db:migrate
npm run db:seed
```

---

## 5. Summary of Google Family Stack

| Component | Previous Solution | Google / Firebase Solution | Status |
|---|---|---|---|
| **Hosting & API** | Vercel / Render | **Firebase App Hosting (Cloud Run)** | Ready (`apphosting.yaml`) |
| **Authentication** | Custom bcrypt + Supabase | **Firebase Auth (Google + Email/Password)** | Active & Configured |
| **Database** | Supabase Postgres (AWS) | **Google Cloud SQL for PostgreSQL** | Migration scripts & config ready |
| **Storage (Assets)** | Local / S3 | **Firebase Storage** (`quickfresh-10mins.firebasestorage.app`) | Configured |
