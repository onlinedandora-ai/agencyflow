import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  handleDeliverableError,
  listPendingReview,
} from "@/lib/server/deliverables";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    return jsonOk(await listPendingReview());
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}
