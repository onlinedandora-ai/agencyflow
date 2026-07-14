import { jsonError, jsonOk } from "@/lib/server/http";
import { findByPublicToken, handleProposalError } from "@/lib/server/proposals";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    return jsonOk(await findByPublicToken(token));
  } catch (error) {
    const handled = handleProposalError(error);
    return jsonError(handled.message, handled.status);
  }
}
