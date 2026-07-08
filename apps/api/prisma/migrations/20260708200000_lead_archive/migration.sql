ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_archivedAt_idx" ON "Lead"("archivedAt");
