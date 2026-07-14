import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { convertLead, handleOnboardingError } from "@/lib/server/onboarding";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  try {
    return jsonOk(await convertLead(leadId));
  } catch (error) {
    const handled = handleOnboardingError(error);
    return jsonError(handled.message, handled.status);
  }
}
