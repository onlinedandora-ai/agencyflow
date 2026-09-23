/**
 * Public site origin for client-facing links (proposals, portal, docs).
 * Prefer explicit WEB_ORIGIN or standard app URLs; fallback to localhost.
 */
export function getWebOrigin(): string {
  const explicit = process.env.WEB_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (publicAppUrl) return publicAppUrl;

  const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL)?.trim().replace(/\/$/, "");
  if (appUrl) return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

  return "http://localhost:3000";
}
