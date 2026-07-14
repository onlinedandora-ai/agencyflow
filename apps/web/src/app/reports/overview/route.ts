import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonOk } from "@/lib/server/http";
import { getReportsOverview } from "@/lib/server/reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  return jsonOk(await getReportsOverview());
}
