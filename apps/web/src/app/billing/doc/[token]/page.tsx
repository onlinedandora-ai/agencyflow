"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InvoiceDocument } from "@/components/invoice-document";
import { api } from "@/lib/api";

export default function BillingDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "1";

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-doc", token],
    queryFn: () => api.getBillingDocument(token),
  });

  useEffect(() => {
    if (shouldPrint && data) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [shouldPrint, data]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Loading document...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-danger)]">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-[800px] px-4 print:max-w-none print:px-0">
        <InvoiceDocument invoice={data.invoice} agency={data.agency} />
      </div>
    </div>
  );
}
