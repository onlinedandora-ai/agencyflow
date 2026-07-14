import { UserRole } from "@prisma/client";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { acknowledgeBillableRevision, handleProjectError } from "@/lib/server/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const roleError = requireRoles(auth, [UserRole.ADMIN, UserRole.CLIENT_MANAGER]);
  if (roleError) return roleError;

  const { taskId } = await context.params;

  try {
    return jsonOk(await acknowledgeBillableRevision(taskId, auth.sub));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}
