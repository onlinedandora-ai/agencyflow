import {
  clientDeliverableFeedbackSchema,
  clientFeedback,
  handleDeliverableError,
} from "@/lib/server/deliverables";
import { jsonError, jsonOk } from "@/lib/server/http";

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

  const parsed = clientDeliverableFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await clientFeedback(token, parsed.data));
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}
