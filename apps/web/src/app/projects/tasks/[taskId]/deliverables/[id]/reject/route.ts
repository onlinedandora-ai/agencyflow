import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  handleDeliverableError,
  rejectDeliverable,
  reviewDeliverableSchema,
} from "@/lib/server/deliverables";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ taskId: string; id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { taskId, id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = reviewDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(
      await rejectDeliverable(taskId, id, auth.sub, auth.role, parsed.data),
    );
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}
