import { NextResponse } from "next/server";
import { getBillingPortal, handleInvoiceError } from "@/lib/server/invoices";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/c/${token}#billing`, request.url));
  }

  try {
    return jsonOk(await getBillingPortal(token));
  } catch (error) {
    const handled = handleInvoiceError(error);
    return jsonError(handled.message, handled.status);
  }
}
