import { jsonError, jsonOk } from "@/lib/server/http";
import {
  acceptProposalByToken,
  acceptProposalSchema,
  handleProposalError,
} from "@/lib/server/proposals";

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

  const parsed = acceptProposalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await acceptProposalByToken(token, parsed.data));
  } catch (error) {
    const handled = handleProposalError(error);
    return jsonError(handled.message, handled.status);
  }
}
