"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { InvoiceDocument } from "@/components/invoice-document";
import {
  PublicErrorState,
  PublicLoadingState,
  PublicPageLayout,
} from "@/components/public-page-layout";
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
    return <PublicLoadingState message="Loading document..." />;
  }

  if (error || !data) {
    return <PublicErrorState message="Document not found." />;
  }

  return (
    <PublicPageLayout>
      <div className="print:max-w-none print:px-0">
        <InvoiceDocument invoice={data.invoice} agency={data.agency} />
      </div>
    </PublicPageLayout>
  );
}
