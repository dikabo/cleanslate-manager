import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArticleType, Material } from "@/types";
import { toast } from "sonner";

// Recalculate order subtotal/total while preserving any existing discount.
export async function recalcOrderAmounts(orderId: string) {
  const { data: items, error: fetchErr } = await supabase
    .from("order_items")
    .select("price")
    .eq("order_id", orderId);

  if (fetchErr) throw fetchErr;

  const subtotalAmount = (items || []).reduce((sum, item) => sum + (item.price || 0), 0);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("discount_amount, paid_amount")
    .eq("id", orderId)
    .single();

  if (orderErr) throw orderErr;

  const discountAmount = Math.max(0, Math.min(order?.discount_amount || 0, subtotalAmount));
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);
  const isPaid = (order?.paid_amount || 0) >= totalAmount;

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      is_paid: isPaid,
    })
    .eq("id", orderId);

  if (updErr) throw updErr;
}

export function useUpdateArticle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      articleId,
      data,
    }: {
      articleId: string;
      data: {
        article_type?: ArticleType;
        custom_article_type?: string | null;
        material?: Material;
        brand?: string | null;
        color?: string | null;
        description?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("order_articles")
        .update(data)
        .eq("id", articleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Article modifie");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      articleId,
      orderId,
    }: {
      articleId: string;
      orderId: string;
    }) => {
      const { data: items } = await supabase
        .from("order_items")
        .select("id")
        .eq("article_id", articleId);

      if (items && items.length > 0) {
        const itemIds = items.map((item) => item.id);
        await supabase
          .from("order_item_partners")
          .delete()
          .in("order_item_id", itemIds);
      }

      const { error: itemsErr } = await supabase
        .from("order_items")
        .delete()
        .eq("article_id", articleId);
      if (itemsErr) throw itemsErr;

      const { data: articlePhotos } = await supabase
        .from("photos")
        .select("url")
        .eq("article_id", articleId);

      if (articlePhotos && articlePhotos.length > 0) {
        const storagePaths = articlePhotos
          .map((photo) => {
            try {
              const url = new URL(photo.url);
              const match = url.pathname.match(/\/storage\/v1\/object\/public\/order-photos\/(.+)/);
              return match ? match[1] : null;
            } catch {
              return null;
            }
          })
          .filter((path): path is string => path !== null);

        if (storagePaths.length > 0) {
          await supabase.storage.from("order-photos").remove(storagePaths);
        }
      }

      await supabase.from("photos").delete().eq("article_id", articleId);

      const { error: artErr } = await supabase
        .from("order_articles")
        .delete()
        .eq("id", articleId);
      if (artErr) throw artErr;

      await recalcOrderAmounts(orderId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Article supprime");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      orderId,
      data,
    }: {
      itemId: string;
      orderId: string;
      data: { price?: number; service_name?: string };
    }) => {
      const { error } = await supabase
        .from("order_items")
        .update(data)
        .eq("id", itemId);
      if (error) throw error;

      if (data.price !== undefined) {
        await recalcOrderAmounts(orderId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Service modifie");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      orderId,
    }: {
      itemId: string;
      orderId: string;
    }) => {
      await supabase
        .from("order_item_partners")
        .delete()
        .eq("order_item_id", itemId);

      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;

      await recalcOrderAmounts(orderId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Service supprime");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}

export function useApplyOrderDiscount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      discountAmount,
      discountReason,
    }: {
      orderId: string;
      discountAmount: number;
      discountReason: string;
    }) => {
      const reason = discountReason.trim();
      if (!reason) {
        throw new Error("Veuillez renseigner le motif de la remise.");
      }

      const { data: order, error: fetchErr } = await supabase
        .from("orders")
        .select("subtotal_amount, total_amount, paid_amount")
        .eq("id", orderId)
        .single();

      if (fetchErr) throw fetchErr;

      const subtotalAmount = order.subtotal_amount ?? order.total_amount ?? 0;
      const normalizedDiscount = Math.max(0, Math.min(discountAmount, subtotalAmount));
      const totalAmount = Math.max(0, subtotalAmount - normalizedDiscount);
      const isPaid = (order.paid_amount || 0) >= totalAmount;

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          subtotal_amount: subtotalAmount,
          discount_amount: normalizedDiscount,
          discount_reason: reason,
          discount_applied_at: new Date().toISOString(),
          total_amount: totalAmount,
          is_paid: isPaid,
        })
        .eq("id", orderId);

      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Remise appliquee avec succes");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      cancelReason,
    }: {
      orderId: string;
      cancelReason: string;
    }) => {
      const reason = cancelReason.trim();
      if (!reason) {
        throw new Error("Veuillez saisir le motif d'annulation.");
      }

      const { data: existingOrder, error: fetchErr } = await supabase
        .from("orders")
        .select("id, status, ticket_number, client_id, total_amount, paid_amount, created_at, updated_at")
        .eq("id", orderId)
        .single();

      if (fetchErr) throw fetchErr;

      if (!existingOrder || existingOrder.status !== "received") {
        throw new Error(
          "Suppression impossible: seule une commande en reception peut etre annulee."
        );
      }

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      if (!currentUserId) {
        throw new Error("Utilisateur non authentifie.");
      }

      const { error: auditErr } = await supabase
        .from("order_cancellations" as any)
        .insert({
          order_id: existingOrder.id,
          ticket_number: existingOrder.ticket_number,
          client_id: existingOrder.client_id,
          total_amount: existingOrder.total_amount ?? 0,
          paid_amount: existingOrder.paid_amount ?? 0,
          cancel_reason: reason,
          cancelled_by: currentUserId,
          order_snapshot: existingOrder,
        });

      if (auditErr) throw auditErr;

      const { error: deleteErr } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (deleteErr) throw deleteErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      toast.success("Commande annulee avec succes");
    },
    onError: (e: Error) => toast.error(`Erreur: ${e.message}`),
  });
}
