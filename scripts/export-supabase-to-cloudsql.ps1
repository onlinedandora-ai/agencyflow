<#
.SYNOPSIS
  Migrate AgencyFlow database schema & data from Supabase to Google Cloud SQL (PostgreSQL).

.EXAMPLE
  .\scripts\export-supabase-to-cloudsql.ps1 -SourceUrl "postgresql://..." -TargetUrl "postgresql://..."
#>

param(
  [Parameter(Mandatory=$false)]
  [string]$SourceUrl = $env:DATABASE_URL,

  [Parameter(Mandatory=$false)]
  [string]$TargetUrl = $env:CLOUD_SQL_URL,

  [Parameter(Mandatory=$false)]
  [string]$DumpFile = "agencyflow_backup.dump"
)

Write-Host "=== AgencyFlow Supabase to Google Cloud SQL Migration ===" -ForegroundColor Cyan

if (-not $SourceUrl) {
  Write-Error "Source database URL is required. Pass -SourceUrl or set DATABASE_URL."
  exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Warning "pg_dump is not in PATH. If you have PostgreSQL installed, ensure its bin folder is in PATH."
  Write-Host "Alternative: You can apply migrations directly to Google Cloud SQL using:" -ForegroundColor Yellow
  Write-Host "  DATABASE_URL=`"$TargetUrl`" npm run db:migrate" -ForegroundColor Green
  Write-Host "  DATABASE_URL=`"$TargetUrl`" npm run db:seed" -ForegroundColor Green
  exit 0
}

Write-Host "1. Dumping data from source PostgreSQL..." -ForegroundColor Yellow
pg_dump --format=custom --no-owner --no-privileges --dbname="$SourceUrl" --file="$DumpFile"

if ($LASTEXITCODE -eq 0) {
  Write-Host "✓ Dump completed successfully: $DumpFile" -ForegroundColor Green
} else {
  Write-Error "Failed to dump database from source."
  exit 1
}

if ($TargetUrl) {
  Write-Host "2. Restoring dump to target Google Cloud SQL database..." -ForegroundColor Yellow
  pg_restore --no-owner --no-privileges --dbname="$TargetUrl" "$DumpFile"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Restore completed successfully into Google Cloud SQL!" -ForegroundColor Green
  } else {
    Write-Warning "pg_restore finished with warnings or non-zero exit code (often benign for existing tables)."
  }
} else {
  Write-Host "No TargetUrl provided. Backup saved to $DumpFile." -ForegroundColor Cyan
  Write-Host "When your Google Cloud SQL instance is ready, restore with:" -ForegroundColor White
  Write-Host "  pg_restore --no-owner --no-privileges --dbname=`"postgresql://USER:PASSWORD@HOST:5432/agencyflow`" $DumpFile"
}
