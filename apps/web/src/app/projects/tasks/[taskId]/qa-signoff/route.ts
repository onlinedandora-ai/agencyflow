import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { handleProjectError, signOffQa } from "@/lib/server/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { taskId } = await context.params;

  try {
    return jsonOk(await signOffQa(taskId, auth.sub));
  } catch (error) {
    const handled = handleProjectError(error);
    return jsonError(handled.message, handled.status);
  }
}
