import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  handleDeliverableError,
  submitDeliverable,
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

  try {
    return jsonOk(
      await submitDeliverable(taskId, id, auth.sub, auth.role),
    );
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}
