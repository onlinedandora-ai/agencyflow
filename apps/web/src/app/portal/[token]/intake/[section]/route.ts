import { jsonError, jsonOk } from "@/lib/server/http";
import {
  handlePortalError,
  parseIntakeSection,
  saveIntake,
  saveIntakeSchema,
} from "@/lib/server/portal";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string; section: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { token, section } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = saveIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(
      await saveIntake(token, parseIntakeSection(section), parsed.data.data),
    );
  } catch (error) {
    const handled = handlePortalError(error);
    return jsonError(handled.message, handled.status);
  }
}
