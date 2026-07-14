import { UserRole } from "@prisma/client";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { archiveLead, handleLeadError } from "@/lib/server/leads";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth(_request);
  if (isAuthError(auth)) return auth;

  const roleError = requireRoles(auth, [UserRole.ADMIN, UserRole.CLIENT_MANAGER]);
  if (roleError) return roleError;

  const { id } = await context.params;

  try {
    return jsonOk(await archiveLead(id));
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}
