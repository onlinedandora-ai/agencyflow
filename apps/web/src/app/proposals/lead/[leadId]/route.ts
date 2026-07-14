import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  findProposalByLead,
  handleProposalError,
  upsertProposal,
  upsertProposalSchema,
} from "@/lib/server/proposals";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  try {
    return jsonOk(await findProposalByLead(leadId));
  } catch (error) {
    const handled = handleProposalError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = upsertProposalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await upsertProposal(leadId, parsed.data));
  } catch (error) {
    const handled = handleProposalError(error);
    return jsonError(handled.message, handled.status);
  }
}
