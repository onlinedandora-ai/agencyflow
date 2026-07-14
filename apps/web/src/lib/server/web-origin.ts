/**
 * Public site origin for client-facing links (proposals, portal, docs).
 * Prefer explicit WEB_ORIGIN; on Vercel fall back to production/deploy URLs.
 */
export function getWebOrigin(): string {
  const explicit = process.env.WEB_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(
    /^https?:\/\//,
    "",
  );
  if (production) return `https://${production}`;

  const deploy = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  if (deploy) return `https://${deploy}`;

  return "http://localhost:3000";
}
