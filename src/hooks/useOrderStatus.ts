import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStatus } from "@/types";
import { toast } from "sonner";

const statusFlow: OrderStatus[] = [
  "received",
  "validated",
  "sent_to_partner",
  "received_from_partner",
  "ready",
  "delivered",
];

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  const idx = statusFlow.indexOf(current);
  if (idx === -1 || idx >= statusFlow.length - 1) return null;
  return statusFlow[idx + 1];
}

export function getPreviousStatus(current: OrderStatus): OrderStatus | null {
  const idx = statusFlow.indexOf(current);
  if (idx <= 0) return null;
  return statusFlow[idx - 1];
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      currentStatus,
      paidAmount,
      totalAmount,
    }: {
      orderId: string;
      currentStatus: OrderStatus;
      paidAmount?: number;
      totalAmount?: number;
    }) => {
      const nextStatus = getNextStatus(currentStatus);
      if (!nextStatus) throw new Error("Impossible d'avancer le statut");

      if (nextStatus === "delivered") {
        const paid = paidAmount ?? 0;
        const total = totalAmount ?? 0;
        if (total > 0 && paid < total) {
          throw new Error(
            `Le solde n'est pas regle (${paid} / ${total} FCFA). Veuillez encaisser le solde avant la livraison.`
          );
        }

        const { data: remainingArticles, error: articlesError } = await supabase
          .from("order_articles")
          .select("id")
          .eq("order_id", orderId)
          .is("picked_up_at", null);

        if (articlesError) throw articlesError;

        if (remainingArticles && remainingArticles.length > 0) {
          const now = new Date().toISOString();
          const { error: bulkUpdateError } = await supabase
            .from("order_articles")
            .update({ picked_up_at: now })
            .eq("order_id", orderId)
            .is("picked_up_at", null);

          if (bulkUpdateError) throw bulkUpdateError;
        }
      }

      if (nextStatus === "sent_to_partner") {
        const paid = paidAmount ?? 0;
        if (paid === 0) {
          toast.warning(
            "Aucune avance n'a ete versee pour cette commande. Pensez a encaisser l'avance."
          );
        }
      }

      if (nextStatus === "sent_to_partner" || nextStatus === "received_from_partner") {
        return nextStatus;
      }

      const updateData: Record<string, unknown> = { status: nextStatus };

      if (nextStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;
      return nextStatus;
    },
    onSuccess: (nextStatus) => {
      if (nextStatus === "sent_to_partner" || nextStatus === "received_from_partner") {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      const labels: Record<string, string> = {
        validated: "Validee",
        sent_to_partner: "En production",
        received_from_partner: "Production terminee",
        ready: "Pret",
        delivered: "Livre",
      };
      toast.success(`Statut avance -> ${labels[nextStatus] || nextStatus}`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}
