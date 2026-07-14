import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { handleOnboardingError, listWorkspaces } from "@/lib/server/onboarding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    return jsonOk(await listWorkspaces());
  } catch (error) {
    const handled = handleOnboardingError(error);
    return jsonError(handled.message, handled.status);
  }
}
