import { UserRole } from "@prisma/client";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  createTask,
  createTaskSchema,
  handleProjectError,
} from "@/lib/server/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const roleError = requireRoles(auth, [UserRole.ADMIN, UserRole.CLIENT_MANAGER]);
  if (roleError) return roleError;

  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await createTask(projectId, parsed.data));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}
