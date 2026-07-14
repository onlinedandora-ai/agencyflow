import { UserRole } from "@prisma/client";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  getTask,
  handleProjectError,
  updateTask,
  updateTaskSchema,
} from "@/lib/server/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { taskId } = await context.params;

  try {
    return jsonOk(await getTask(taskId));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const roleError = requireRoles(auth, [UserRole.ADMIN, UserRole.CLIENT_MANAGER]);
  if (roleError) return roleError;

  const { taskId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await updateTask(taskId, parsed.data));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}
