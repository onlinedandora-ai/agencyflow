import { UserRole } from "@prisma/client";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  deleteLead,
  findLeadById,
  handleLeadError,
  updateLead,
  updateLeadSchema,
} from "@/lib/server/leads";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  try {
    return jsonOk(await findLeadById(id));
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await updateLead(id, parsed.data));
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const roleError = requireRoles(auth, [UserRole.ADMIN, UserRole.CLIENT_MANAGER]);
  if (roleError) return roleError;

  const { id } = await context.params;

  try {
    return jsonOk(await deleteLead(id));
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}
