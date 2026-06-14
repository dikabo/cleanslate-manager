import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Order, OrderItem, OrderItemPartner } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";
import { CheckCircle, Package, Star, MessageSquare, Building, Home, Camera, ZoomIn, Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface OrderReceiveFromPartnerDialogProps {
    open: boolean;
    onClose: () => void;
    order: Order | null;
    onSuccess: () => void;
}

interface TaskReceipt {
    completed: boolean;
    qualityRating: number;
    ratingNotes: string;
}

export function OrderReceiveFromPartnerDialog({
    open,
    onClose,
    order,
    onSuccess,
}: OrderReceiveFromPartnerDialogProps) {
    const queryClient = useQueryClient();
    // Keyed by order_item_partner.id (or "internal-{item.id}" for internal items)
    const [taskReceipts, setTaskReceipts] = useState<Record<string, TaskReceipt>>({});
    const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string; filename: string } | null>(null);

    // Collect all production items (sent_to_partner or at_partner)
    const productionItems = useMemo(() => {
        if (!order?.order_items) return [];
        return order.order_items.filter(
            item => item.status === "sent_to_partner" || item.status === "at_partner" || item.assigned_to_partner_id
        );
    }, [order]);

    // Flatten to a list of "tasks" — either from order_item_partners, or the item itself (internal)
    const allTasks = useMemo(() => {
        const tasks: Array<{
            key: string;
            item: OrderItem;
            partnerTask?: OrderItemPartner;
            isInternal: boolean;
            partnerName: string;
            taskDescription: string;
        }> = [];

        for (const item of productionItems) {
            const partners = item.order_item_partners || [];
            if (partners.length > 0) {
                for (const p of partners) {
                    // Only show tasks not yet received
                    if (p.status === "received" || p.status === "completed") continue;
                    tasks.push({
                        key: p.id,
                        item,
                        partnerTask: p,
                        isInternal: false,
                        partnerName: p.partners?.name || "Partenaire inconnu",
                        taskDescription: p.task_description,
                    });
                }
            } else {
                // Internal or legacy single-partner item
                tasks.push({
                    key: `internal-${item.id}`,
                    item,
                    isInternal: item.is_internal,
                    partnerName: item.is_internal ? "Maison" : (item.partners?.name || "Inconnu"),
                    taskDescription: item.service_name,
                });
            }
        }
        return tasks;
    }, [productionItems]);

    // Build a lookup: article_id → article object (from order_articles)
    const articlesById = useMemo(() => {
        const map = new Map<string, typeof order extends null ? never : NonNullable<NonNullable<typeof order>['order_articles']>[number]>();
        if (!order?.order_articles) return map;
        for (const article of order.order_articles) {
            map.set(article.id, article);
        }
        return map;
    }, [order]);

    // Build a lookup: article_id → photos (from order.photos, matched by article_id)
    const photosByArticleId = useMemo(() => {
        const map = new Map<string, Array<{ url: string; type: string }>>();
        if (!order?.photos) return map;
        for (const photo of order.photos) {
            if (photo.article_id) {
                const existing = map.get(photo.article_id) || [];
                existing.push({ url: photo.url, type: photo.type });
                map.set(photo.article_id, existing);
            }
        }
        return map;
    }, [order]);

    // Helper: get the best thumbnail photo for an order item
    const getArticleThumbnail = (item: OrderItem) => {
        const articleId = (item as { article_id?: string }).article_id;
        if (!articleId) return null;

        // First try article-level photos
        const articlePhotos = photosByArticleId.get(articleId);
        if (articlePhotos && articlePhotos.length > 0) {
            // Prefer "before" type
            const before = articlePhotos.find(p => p.type === "before");
            return before || articlePhotos[0];
        }

        // Fallback: check order-level photos without article_id (legacy)
        if (order?.photos) {
            const genericPhotos = order.photos.filter(p => !p.article_id);
            if (genericPhotos.length > 0) {
                const before = genericPhotos.find(p => p.type === "before");
                return before || genericPhotos[0];
            }
        }

        return null;
    };

    // Helper: get article label
    const getArticleLabel = (item: OrderItem) => {
        const articleId = (item as { article_id?: string }).article_id;
        if (!articleId) return "Article";
        const article = articlesById.get(articleId);
        if (!article) return "Article";
        const typeName = getArticleTypeDisplayName(article.article_type, article.custom_article_type);
        return `${typeName}${article.brand ? ` (${article.brand})` : ""}`;
    };

    const handleDownloadPhoto = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading photo:', error);
            window.open(url, '_blank');
        }
    };

    // Initialize receipts when dialog opens
    useMemo(() => {
        if (open && allTasks.length > 0) {
            const initial: Record<string, TaskReceipt> = {};
            for (const task of allTasks) {
                initial[task.key] = {
                    completed: false,
                    qualityRating: 0,
                    ratingNotes: "",
                };
            }
            setTaskReceipts(initial);
        }
    }, [open, allTasks.length]);

    const updateTaskReceipt = (key: string, field: keyof TaskReceipt, value: string | number | boolean) => {
        setTaskReceipts(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const completedCount = Object.values(taskReceipts).filter(r => r.completed).length;

    const receiveFromPartnerMutation = useMutation({
        mutationFn: async () => {
            if (!order) return;

            const now = new Date().toISOString();

            // Process each task
            for (const task of allTasks) {
                const receipt = taskReceipts[task.key];
                if (!receipt?.completed) continue;

                if (task.partnerTask) {
                    // Update the specific order_item_partner
                    const updatePartnerData: Record<string, unknown> = {
                        status: "received",
                        received_at: now,
                    };
                    await supabase
                        .from("order_item_partners")
                        .update(updatePartnerData)
                        .eq("id", task.partnerTask.id);
                }

                // Check if ALL tasks for this item are now done
                const itemPartners = task.item.order_item_partners || [];

                let allItemTasksDone = true;

                if (itemPartners.length > 0) {
                    // Check every partner task for this item
                    for (const p of itemPartners) {
                        if (p.id === task.partnerTask?.id) {
                            // This one is being marked done right now
                            continue;
                        }
                        const otherReceipt = taskReceipts[p.id];
                        if (otherReceipt?.completed) continue;
                        // Check DB status
                        if (p.status === "received" || p.status === "completed") continue;
                        allItemTasksDone = false;
                        break;
                    }
                }

                if (allItemTasksDone) {
                    // All tasks for this order_item are done → mark item as received
                    const updateData: Record<string, unknown> = {
                        status: "received_from_partner",
                        received_from_partner_at: now,
                    };
                    if (receipt.qualityRating > 0) {
                        updateData.quality_rating = receipt.qualityRating;
                    }
                    if (receipt.ratingNotes) {
                        updateData.rating_notes = receipt.ratingNotes;
                    }

                    await supabase
                        .from("order_items")
                        .update(updateData)
                        .eq("id", task.item.id);
                }
            }

            // Check if ALL production items are now received
            // Re-fetch fresh statuses
            const { data: freshItems } = await supabase
                .from("order_items")
                .select("id, status")
                .eq("order_id", order.id);

            const allDone = freshItems?.every(
                i => i.status === "received_from_partner" || i.status === "completed"
            );

            if (allDone) {
                await supabase
                    .from("orders")
                    .update({ status: "received_from_partner" })
                    .eq("id", order.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
            queryClient.invalidateQueries({ queryKey: ["partner-items"] });
            queryClient.invalidateQueries({ queryKey: ["order-detail"] });
            toast.success("Travaux mis à jour avec succès");
            onSuccess();
            onClose();
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    if (!order) return null;

    return (
        <>
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Fin de Production</DialogTitle>
                    <DialogDescription>
                        Marquez chaque travail terminé pour la commande <span className="font-semibold text-foreground">{order.ticket_number}</span>. L'étape est validée lorsque tous les travaux sont terminés.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {allTasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Aucun travail en cours pour cette commande.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Travaux en cours ({allTasks.length})
                                {completedCount > 0 && (
                                    <Badge variant="secondary" className="ml-auto">
                                        {completedCount}/{allTasks.length} terminés
                                    </Badge>
                                )}
                            </h4>

                            {allTasks.map((task) => {
                                const receipt = taskReceipts[task.key] || { completed: false, qualityRating: 0, ratingNotes: "" };
                                const thumbnail = getArticleThumbnail(task.item);
                                const articleLabel = getArticleLabel(task.item);

                                return (
                                    <div key={task.key} className={cn(
                                        "border rounded-lg p-4 space-y-3 transition-colors",
                                        receipt.completed ? "bg-emerald-50/50 border-emerald-200" : "bg-background"
                                    )}>
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Article thumbnail */}
                                            {thumbnail ? (
                                                <div
                                                    className="relative group w-14 h-14 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 border shadow-sm"
                                                    onClick={() => setPreviewPhoto({
                                                        url: thumbnail.url,
                                                        label: `${articleLabel} — ${order.ticket_number}`,
                                                        filename: `photo-${order.ticket_number}-${task.key}.jpg`
                                                    })}
                                                >
                                                    <img src={thumbnail.url} alt={articleLabel} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border">
                                                    <Camera className="h-5 w-5 text-muted-foreground/40" />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm">{task.item.service_name}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{articleLabel}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {task.isInternal ? (
                                                        <Badge variant="outline" className="text-[10px] py-0 gap-1">
                                                            <Home className="h-3 w-3" />
                                                            Maison
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-orange-100 text-orange-800 text-[10px] py-0 gap-1">
                                                            <Building className="h-3 w-3" />
                                                            {task.partnerName}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground truncate">
                                                        {task.taskDescription}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                variant={receipt.completed ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => updateTaskReceipt(task.key, 'completed', !receipt.completed)}
                                                className={cn("h-8 px-3 text-xs w-28 flex-shrink-0", receipt.completed && "bg-emerald-600 hover:bg-emerald-700")}
                                            >
                                                {receipt.completed ? (
                                                    <><CheckCircle className="h-4 w-4 mr-1.5" /> Terminé</>
                                                ) : (
                                                    "En cours"
                                                )}
                                            </Button>
                                        </div>

                                        {receipt.completed && (
                                            <div className="pt-3 border-t grid gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs flex items-center gap-1.5">
                                                        <Star className="h-3 w-3" />
                                                        Qualité du travail
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => updateTaskReceipt(task.key, 'qualityRating', star)}
                                                                className={cn(
                                                                    "p-1.5 rounded-full hover:bg-muted transition-colors",
                                                                    star <= receipt.qualityRating ? "text-yellow-400" : "text-muted-foreground/30"
                                                                )}
                                                            >
                                                                <Star className={cn("h-5 w-5", star <= receipt.qualityRating && "fill-yellow-400")} />
                                                            </button>
                                                        ))}
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            {receipt.qualityRating === 0 ? "Non noté" : `${receipt.qualityRating}/5`}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-xs flex items-center gap-1.5">
                                                        <MessageSquare className="h-3 w-3" />
                                                        Note (Optionnelle)
                                                    </Label>
                                                    <Input
                                                        placeholder="Observations sur le travail réalisé..."
                                                        className="h-8 text-sm"
                                                        value={receipt.ratingNotes}
                                                        onChange={(e) => updateTaskReceipt(task.key, 'ratingNotes', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="border-t pt-4 mt-4 bg-background">
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Annuler
                        </Button>
                        <Button
                            onClick={() => receiveFromPartnerMutation.mutate()}
                            disabled={receiveFromPartnerMutation.isPending || completedCount === 0}
                            className="flex-1"
                        >
                            {receiveFromPartnerMutation.isPending ? "Mise à jour..." : (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Valider ({completedCount} travaux)
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Photo Preview Dialog */}
        <Dialog open={!!previewPhoto} onOpenChange={(isOpen) => !isOpen && setPreviewPhoto(null)}>
            <DialogContent className="max-w-4xl bg-black/95 border-neutral-800 p-0 shadow-2xl overflow-hidden [&>button]:hidden">
                <DialogTitle className="sr-only">Aperçu photo {previewPhoto?.label}</DialogTitle>
                <DialogDescription className="sr-only">Visionneuse photo plein écran pour vérification de l'article</DialogDescription>

                <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40 absolute top-0 left-0 right-0 z-10">
                    <div className="text-white/90 text-sm font-medium px-2">
                        {previewPhoto?.label}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/10 hover:bg-white/20 text-white border-0"
                            onClick={() => previewPhoto && handleDownloadPhoto(previewPhoto.url, previewPhoto.filename)}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-9 w-9 p-0"
                            onClick={() => setPreviewPhoto(null)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh] p-0 relative">
                    {previewPhoto && (
                        <img
                            src={previewPhoto.url}
                            alt="Preview"
                            className="w-auto h-auto max-w-full max-h-[85vh] object-contain transition-all duration-300"
                        />
                    )}
                    <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"></div>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
