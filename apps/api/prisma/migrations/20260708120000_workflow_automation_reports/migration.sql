-- AlterTable
ALTER TABLE "AgencyProfile" ADD COLUMN IF NOT EXISTS "workflowSettings" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutomationRun" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationRun_jobType_idx" ON "AutomationRun"("jobType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationRun_createdAt_idx" ON "AutomationRun"("createdAt");
