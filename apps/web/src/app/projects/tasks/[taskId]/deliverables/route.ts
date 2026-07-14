import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  createDeliverable,
  createDeliverableSchema,
  handleDeliverableError,
  listForTask,
} from "@/lib/server/deliverables";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { taskId } = await context.params;

  try {
    return jsonOk(await listForTask(taskId));
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { taskId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(
      await createDeliverable(taskId, parsed.data, auth.sub, auth.role),
    );
  } catch (error) {
    const handled = handleDeliverableError(error);
    return jsonError(handled.message, handled.status);
  }
}
