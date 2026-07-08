"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";

type Props = {
  token: string;
  invoiceId: string;
  milestoneId?: string;
  payerName: string;
  payerEmail?: string;
  agencyName: string;
  amountLabel: string;
  disabled?: boolean;
  onSuccess: () => void;
};

export function RazorpayPayButton({
  token,
  invoiceId,
  milestoneId,
  payerName,
  payerEmail,
  agencyName,
  amountLabel,
  disabled,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    if (!payerName.trim()) {
      setError("Enter your name before paying online.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loadRazorpayScript();
      const order = await api.createRazorpayOrder(token, {
        invoiceId,
        milestoneId: milestoneId || undefined,
        payerName: payerName.trim(),
        payerEmail: payerEmail?.trim() || undefined,
      });

      if (!window.Razorpay) throw new Error("Razorpay failed to load");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: agencyName,
        description: order.milestoneLabel
          ? `${order.invoiceNumber} — ${order.milestoneLabel}`
          : order.invoiceNumber,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#4F46E5" },
        handler: async (response) => {
          try {
            await api.verifyRazorpayPayment(token, response);
            onSuccess();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Payment verification failed");
          }
        },
      });

      rzp.on("payment.failed", (response) => {
        setError(response.error?.description ?? "Payment failed");
      });

      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full sm:w-auto" onClick={handlePay} disabled={disabled || loading}>
        <CreditCard className="h-4 w-4" />
        {loading ? "Opening checkout..." : `Pay online — ${amountLabel}`}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
