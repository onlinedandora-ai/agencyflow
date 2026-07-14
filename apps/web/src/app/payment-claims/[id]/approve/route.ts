import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  approvePaymentClaim,
  handlePaymentError,
  reviewPaymentClaimSchema,
} from "@/lib/server/payments";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = reviewPaymentClaimSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await approvePaymentClaim(id, auth.sub, parsed.data));
  } catch (error) {
    const handled = handlePaymentError(error);
    return jsonError(handled.message, handled.status);
  }
}
