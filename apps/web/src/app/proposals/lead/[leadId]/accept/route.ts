import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  acceptProposal,
  acceptProposalSchema,
  handleProposalError,
} from "@/lib/server/proposals";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = acceptProposalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await acceptProposal(leadId, parsed.data, auth.sub));
  } catch (error) {
    const handled = handleProposalError(error);
    return jsonError(handled.message, handled.status);
  }
}
