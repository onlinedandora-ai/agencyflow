import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getWorkspace, handleOnboardingError } from "@/lib/server/onboarding";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  try {
    return jsonOk(await getWorkspace(id));
  } catch (error) {
    const handled = handleOnboardingError(error);
    return jsonError(handled.message, handled.status);
  }
}
