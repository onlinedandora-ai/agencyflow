import { isAuthError, requireAuth } from "@/lib/server/auth";
import { getMilestoneTemplates, handleInvoiceError } from "@/lib/server/invoices";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    return jsonOk(await getMilestoneTemplates());
  } catch (error) {
    const handled = handleInvoiceError(error);
    return jsonError(handled.message, handled.status);
  }
}
