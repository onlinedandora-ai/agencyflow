import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { findProjectById, handleProjectError } from "@/lib/server/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { projectId } = await context.params;

  try {
    return jsonOk(await findProjectById(projectId));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}
