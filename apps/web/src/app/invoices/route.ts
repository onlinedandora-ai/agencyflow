import { InvoiceDocumentType, InvoiceStatus } from "@prisma/client";
import { isAuthError, requireAuth } from "@/lib/server/auth";
import { findAllInvoices, handleInvoiceError } from "@/lib/server/invoices";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("documentType") as InvoiceDocumentType | null;
  const status = searchParams.get("status") as InvoiceStatus | null;

  try {
    return jsonOk(
      await findAllInvoices({
        documentType: documentType ?? undefined,
        status: status ?? undefined,
      }),
    );
  } catch (error) {
    const handled = handleInvoiceError(error);
    return jsonError(handled.message, handled.status);
  }
}
