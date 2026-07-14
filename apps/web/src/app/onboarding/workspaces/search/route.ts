import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { handleOnboardingError, searchWorkspaces } from "@/lib/server/onboarding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  try {
    return jsonOk(await searchWorkspaces(q));
  } catch (error) {
    const handled = handleOnboardingError(error);
    return jsonError(handled.message, handled.status);
  }
}
