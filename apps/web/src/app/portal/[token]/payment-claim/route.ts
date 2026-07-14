import { jsonError, jsonOk } from "@/lib/server/http";
import {
  handlePaymentError,
  submitPaymentClaim,
  submitPaymentClaimSchema,
} from "@/lib/server/payments";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = submitPaymentClaimSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await submitPaymentClaim(token, parsed.data));
  } catch (error) {
    const handled = handlePaymentError(error);
    return jsonError(handled.message, handled.status);
  }
}
