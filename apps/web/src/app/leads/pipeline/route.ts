import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { findLeadsByStage, handleLeadError } from "@/lib/server/leads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    return jsonOk(await findLeadsByStage());
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}
