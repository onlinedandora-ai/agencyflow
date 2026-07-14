import { PaymentClaimStatus } from "@prisma/client";
import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { handlePaymentError, listPaymentClaims } from "@/lib/server/payments";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as PaymentClaimStatus | null;

  try {
    return jsonOk(await listPaymentClaims(status ?? undefined));
  } catch (error) {
    const handled = handlePaymentError(error);
    return jsonError(handled.message, handled.status);
  }
}
