import { isAuthError, requireAuth } from "@/lib/server/auth";
import { findInvoiceById, handleInvoiceError } from "@/lib/server/invoices";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  try {
    return jsonOk(await findInvoiceById(id));
  } catch (error) {
    const handled = handleInvoiceError(error);
    return jsonError(handled.message, handled.status);
  }
}
