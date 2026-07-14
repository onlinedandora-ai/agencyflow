import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  handleInvoiceError,
  sendMilestoneNotification,
  sendMilestoneNotificationSchema,
} from "@/lib/server/invoices";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ milestoneId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { milestoneId } = await context.params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = sendMilestoneNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await sendMilestoneNotification(milestoneId, parsed.data, auth.sub));
  } catch (error) {
    const handled = handleInvoiceError(error);
    return jsonError(handled.message, handled.status);
  }
}
