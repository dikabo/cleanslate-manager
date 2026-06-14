import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Payment, PaymentType, PaymentMethod } from "@/types";
import { getSignedPaymentAmount } from "@/lib/reporting";
import { toast } from "sonner";

/**
 * Fetch all payments for a given order
 */
export function usePayments(orderId: string | undefined) {
    return useQuery({
        queryKey: ["payments", orderId],
        enabled: !!orderId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payments")
                .select("*")
                .eq("order_id", orderId!)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data as Payment[];
        },
    });
}

interface RecordPaymentParams {
    orderId: string;
    amount: number;
    paymentType: PaymentType;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
}

/**
 * Record a payment and update the order's paid_amount / is_paid fields
 */
export function useRecordPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            orderId,
            amount,
            paymentType,
            paymentMethod,
            reference,
            notes,
        }: RecordPaymentParams) => {
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("Le montant du paiement doit etre superieur a 0.");
            }

            const { data: order, error: orderFetchError } = await supabase
                .from("orders")
                .select("total_amount")
                .eq("id", orderId)
                .single();
            if (orderFetchError) throw orderFetchError;

            const { data: allPayments, error: paymentsFetchError } = await supabase
                .from("payments")
                .select("amount, payment_type")
                .eq("order_id", orderId);

            if (paymentsFetchError) throw paymentsFetchError;

            const currentPaidAmount = (allPayments || []).reduce(
                (sum, payment) => sum + getSignedPaymentAmount(payment),
                0
            );
            const totalAmount = order.total_amount || 0;

            if (paymentType === "refund") {
                if (amount > currentPaidAmount) {
                    throw new Error(
                        `Remboursement impossible: le montant depasse l'encaissement actuel (${currentPaidAmount} FCFA).`
                    );
                }
            } else {
                const remainingAmount = Math.max(0, totalAmount - currentPaidAmount);
                if (amount > remainingAmount) {
                    throw new Error(
                        `Encaissement impossible: il reste ${remainingAmount} FCFA a payer sur cette commande.`
                    );
                }
            }

            // 1. Insert the payment record only after validating the remaining balance.
            const { error: paymentError } = await supabase.from("payments").insert({
                order_id: orderId,
                amount,
                payment_type: paymentType,
                payment_method: paymentMethod,
                reference: reference || null,
                notes: notes || null,
            });
            if (paymentError) throw paymentError;

            const newPaidAmount = currentPaidAmount + getSignedPaymentAmount({
                amount,
                payment_type: paymentType,
            });
            const normalizedPaidAmount = Math.max(0, Math.min(newPaidAmount, totalAmount));
            const isPaid = normalizedPaidAmount >= totalAmount;

            // 2. Update the order summary fields.
            const { error: updateError } = await supabase
                .from("orders")
                .update({
                    paid_amount: normalizedPaidAmount,
                    is_paid: isPaid,
                })
                .eq("id", orderId);
            if (updateError) throw updateError;

            return { newPaidAmount: normalizedPaidAmount, isPaid };
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["payments", variables.orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
            queryClient.invalidateQueries({ queryKey: ["report-summary"] });
            queryClient.invalidateQueries({ queryKey: ["revenue-orders"] });
            queryClient.invalidateQueries({ queryKey: ["revenue-payments"] });
            queryClient.invalidateQueries({ queryKey: ["payment-status-breakdown"] });
            toast.success("Paiement enregistré avec succès");
        },
        onError: (error) => {
            toast.error(`Erreur paiement: ${error.message}`);
        },
    });
}
