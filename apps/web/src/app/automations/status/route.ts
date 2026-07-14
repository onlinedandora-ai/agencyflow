import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import {
  getAutomationStatus,
} from "@/lib/server/automations";
import { jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

const READ_ROLES = ["ADMIN", "CLIENT_MANAGER"] as const;

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRoles(auth, READ_ROLES);
  if (forbidden) return forbidden;

  return jsonOk(getAutomationStatus());
}
