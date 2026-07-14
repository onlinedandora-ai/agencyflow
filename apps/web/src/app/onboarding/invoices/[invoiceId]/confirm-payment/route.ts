import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { confirmAdvancePayment, handleOnboardingError } from "@/lib/server/onboarding";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { invoiceId } = await context.params;

  try {
    return jsonOk(await confirmAdvancePayment(invoiceId));
  } catch (error) {
    const handled = handleOnboardingError(error);
    return jsonError(handled.message, handled.status);
  }
}
