import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatPrice } from "@/hooks/useServices";
import { Order, OrderItem, Partner, PartnerSpecialty, specialtyLabels } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";
import { Building, CheckCircle, Package, Plus, Trash2, Home, Camera, ZoomIn, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderSendToPartnerDialogProps {
    open: boolean;
    onClose: () => void;
    order: Order | null;
    onSuccess: () => void;
}

interface TaskAssignment {
    partnerId: string;
    taskDescription: string;
    partnerCost: number;
}

interface ItemConfig {
    type: "internal" | "partner";
    tasks: TaskAssignment[];
}

export function OrderSendToPartnerDialog({
    open,
    onClose,
    order,
    onSuccess,
}: OrderSendToPartnerDialogProps) {
    const queryClient = useQueryClient();
    const [sentDate, setSentDate] = useState<string>("");
    // Per-item configurations: each item can be internal or have multiple partner tasks
    const [itemConfigs, setItemConfigs] = useState<Record<string, ItemConfig>>({});
    const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string; filename: string } | null>(null);

    // Fetch partners
    const { data: partners = [] } = useQuery({
        queryKey: ["partners"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("partners")
                .select("*")
                .eq("is_active", true)
                .order("name");
            if (error) throw error;
            return data as Partner[];
        },
    });

    const maisonPartnerId = useMemo(() => {
        return partners.find(p => p.name.toLowerCase().includes('maison'))?.id || "";
    }, [partners]);

    const orderItems = useMemo(() => {
        return order?.order_items || [];
    }, [order]);

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

    // Initialize configs when dialog opens
    useMemo(() => {
        if (open && orderItems.length > 0 && Object.keys(itemConfigs).length === 0) {
            const initial: Record<string, ItemConfig> = {};
            for (const item of orderItems) {
                // Check if there are existing order_item_partners
                const existingPartners = item.order_item_partners || [];
                if (existingPartners.length > 0) {
                    initial[item.id] = {
                        type: "partner",
                        tasks: existingPartners.map(p => ({
                            partnerId: p.partner_id,
                            taskDescription: p.task_description,
                            partnerCost: p.partner_cost || 0,
                        })),
                    };
                } else {
                    initial[item.id] = {
                        type: "internal",
                        tasks: [],
                    };
                }
            }
            setItemConfigs(initial);
        }
    }, [open, orderItems]);

    // Reset when dialog closes
    useMemo(() => {
        if (!open) {
            setItemConfigs({});
            setSentDate("");
        }
    }, [open]);

    const setItemType = (itemId: string, type: "internal" | "partner") => {
        setItemConfigs(prev => ({
            ...prev,
            [itemId]: {
                type,
                tasks: type === "partner" && (prev[itemId]?.tasks.length === 0 || prev[itemId]?.type === "internal")
                    ? [{ partnerId: "", taskDescription: "", partnerCost: 0 }]
                    : prev[itemId]?.tasks || [],
            }
        }));
    };

    const addTask = (itemId: string) => {
        setItemConfigs(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                tasks: [...(prev[itemId]?.tasks || []), { partnerId: "", taskDescription: "", partnerCost: 0 }]
            }
        }));
    };

    const removeTask = (itemId: string, index: number) => {
        setItemConfigs(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                tasks: prev[itemId].tasks.filter((_, i) => i !== index)
            }
        }));
    };

    const updateTask = (itemId: string, index: number, field: keyof TaskAssignment, value: string | number) => {
        setItemConfigs(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                tasks: prev[itemId].tasks.map((t, i) => i === index ? { ...t, [field]: value } : t)
            }
        }));
    };

    // Apply a partner to all items as a quick shortcut
    const applyGlobalPartner = (partnerId: string) => {
        const isMaison = partnerId === maisonPartnerId;
        setItemConfigs(prev => {
            const next = { ...prev };
            for (const item of orderItems) {
                if (isMaison) {
                    next[item.id] = { type: "internal", tasks: [] };
                } else {
                    next[item.id] = {
                        type: "partner",
                        tasks: [{ partnerId, taskDescription: "Service complet", partnerCost: 0 }]
                    };
                }
            }
            return next;
        });
    };

    const sendToPartnerMutation = useMutation({
        mutationFn: async () => {
            if (!order) return;

            const { error: orderError } = await supabase
                .from("orders")
                .update({ status: "sent_to_partner" })
                .eq("id", order.id);

            if (orderError) throw orderError;

            const now = new Date().toISOString();
            const sentTimestamp = sentDate ? new Date(sentDate).toISOString() : now;

            for (const item of orderItems) {
                const config = itemConfigs[item.id];
                const isInternal = !config || config.type === "internal";

                const primaryPartnerId = !isInternal && config.tasks.length > 0 ? config.tasks[0].partnerId : null;
                const totalCost = !isInternal ? config.tasks.reduce((s, t) => s + (t.partnerCost || 0), 0) : 0;

                const updateData: Partial<OrderItem> = {
                    status: "sent_to_partner",
                    sent_to_partner_at: isInternal ? now : sentTimestamp,
                    is_internal: isInternal,
                    assigned_to_partner_id: primaryPartnerId, // Legacy
                    partner_cost: totalCost, // Legacy
                };

                const { error: itemError } = await supabase
                    .from("order_items")
                    .update(updateData)
                    .eq("id", item.id);

                if (itemError) throw itemError;

                // Clear existing order_item_partners
                await supabase.from("order_item_partners").delete().eq("order_item_id", item.id);

                // Create new partner tasks
                if (!isInternal && config.tasks.length > 0) {
                    for (const task of config.tasks) {
                        if (task.partnerId) {
                            await supabase.from("order_item_partners").insert({
                                order_item_id: item.id,
                                partner_id: task.partnerId,
                                task_description: task.taskDescription || "Service complet",
                                partner_cost: task.partnerCost || 0,
                                status: "sent",
                            });
                        }
                    }
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
            queryClient.invalidateQueries({ queryKey: ["partner-items"] });
            queryClient.invalidateQueries({ queryKey: ["order-detail"] });
            toast.success("Commande envoyée en production");
            onSuccess();
            onClose();
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    if (!order) return null;

    const totalCost = orderItems.reduce((sum, item) => {
        const config = itemConfigs[item.id];
        if (!config || config.type === "internal") return sum;
        return sum + config.tasks.reduce((s, t) => s + (t.partnerCost || 0), 0);
    }, 0);
    const totalRevenue = orderItems.reduce((sum, item) => sum + item.price, 0);

    const allConfigured = orderItems.every(item => {
        const config = itemConfigs[item.id];
        if (!config) return false;
        if (config.type === "internal") return true;
        return config.tasks.length > 0 && config.tasks.every(t => t.partnerId);
    });

    return (
        <>
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Envoyer en production</DialogTitle>
                    <DialogDescription>
                        Assignez chaque service de la commande <span className="font-semibold text-foreground">{order.ticket_number}</span> à un ou plusieurs exécutants.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {orderItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Cette commande n'a aucun service à assigner.
                        </div>
                    ) : (
                        <>
                            {/* Quick global assign */}
                            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                <Label>Raccourci : appliquer à tous les services</Label>
                                <Select onValueChange={applyGlobalPartner}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Choisir un exécutant global..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partners.map((partner) => (
                                            <SelectItem key={partner.id} value={partner.id} className={partner.id === maisonPartnerId ? "font-bold text-primary" : ""}>
                                                {partner.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Vous pourrez ensuite ajuster individuellement chaque service.
                                </p>
                            </div>

                            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                <Label>Date d'expédition au partenaire</Label>
                                <Input
                                    type="datetime-local"
                                    value={sentDate}
                                    onChange={(e) => setSentDate(e.target.value)}
                                    className="bg-background w-full md:w-1/2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Laissez vide pour utiliser l'heure actuelle.
                                </p>
                            </div>

                            {/* Per-item config */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Détail par service ({orderItems.length})
                                </h4>

                                {orderItems.map((item) => {
                                    const config = itemConfigs[item.id] || { type: "internal", tasks: [] };
                                    const thumbnail = getArticleThumbnail(item);
                                    const articleLabel = getArticleLabel(item);

                                    return (
                                        <div key={item.id} className="border rounded-lg overflow-hidden">
                                            {/* Item header */}
                                            <div className="bg-muted/30 p-3 flex items-center gap-3">
                                                {/* Article thumbnail */}
                                                {thumbnail ? (
                                                    <div
                                                        className="relative group w-12 h-12 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 border shadow-sm"
                                                        onClick={() => setPreviewPhoto({
                                                            url: thumbnail.url,
                                                            label: `${articleLabel} — ${order.ticket_number}`,
                                                            filename: `photo-${order.ticket_number}-${item.id}.jpg`
                                                        })}
                                                    >
                                                        <img src={thumbnail.url} alt={articleLabel} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border">
                                                        <Camera className="h-5 w-5 text-muted-foreground/40" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{item.service_name}</p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">{articleLabel}</p>
                                                    <p className="text-xs text-muted-foreground">Prix client : {formatPrice(item.price)}</p>
                                                </div>
                                            </div>

                                            <div className="p-3 space-y-3">
                                                {/* Internal / Partner toggle */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setItemType(item.id, "internal")}
                                                        className={cn(
                                                            "p-2.5 rounded-lg border text-left transition-all text-sm",
                                                            config.type === "internal"
                                                                ? "border-primary bg-primary/5 font-medium"
                                                                : "border-border hover:border-primary/50"
                                                        )}
                                                    >
                                                        <Home className="h-4 w-4 text-primary mb-1" />
                                                        Maison
                                                    </button>
                                                    <button
                                                        onClick={() => setItemType(item.id, "partner")}
                                                        className={cn(
                                                            "p-2.5 rounded-lg border text-left transition-all text-sm",
                                                            config.type === "partner"
                                                                ? "border-primary bg-primary/5 font-medium"
                                                                : "border-border hover:border-primary/50"
                                                        )}
                                                    >
                                                        <Building className="h-4 w-4 text-orange-500 mb-1" />
                                                        Partenaire(s)
                                                    </button>
                                                </div>

                                                {/* Multi-partner tasks */}
                                                {config.type === "partner" && (
                                                    <div className="space-y-3">
                                                        {config.tasks.map((task, tIdx) => (
                                                            <div key={tIdx} className="border rounded-lg p-3 bg-card space-y-2 relative">
                                                                {config.tasks.length > 1 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                        onClick={() => removeTask(item.id, tIdx)}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <div className="pr-6">
                                                                    <Label className="text-xs">Partenaire</Label>
                                                                    <Select value={task.partnerId} onValueChange={(v) => updateTask(item.id, tIdx, "partnerId", v)}>
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Choisir..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {partners.filter(p => p.id !== maisonPartnerId).map((partner) => (
                                                                                <SelectItem key={partner.id} value={partner.id} className="text-xs">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span>{partner.name}</span>
                                                                                        {(partner.specialties || [partner.specialty]).slice(0, 1).map(s => (
                                                                                            <Badge key={s} variant="outline" className="text-[9px] py-0 px-1">
                                                                                                {specialtyLabels[s as PartnerSpecialty] || s}
                                                                                            </Badge>
                                                                                        ))}
                                                                                    </div>
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <Label className="text-xs">Tâche</Label>
                                                                        <Input
                                                                            className="h-8 text-xs"
                                                                            value={task.taskDescription}
                                                                            onChange={(e) => updateTask(item.id, tIdx, "taskDescription", e.target.value)}
                                                                            placeholder="Ex: Patin, Lavage..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs">Coût</Label>
                                                                        <Input
                                                                            className="h-8 text-xs"
                                                                            type="number"
                                                                            value={task.partnerCost || ""}
                                                                            onChange={(e) => updateTask(item.id, tIdx, "partnerCost", parseInt(e.target.value) || 0)}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full h-8 text-xs gap-1"
                                                            onClick={() => addTask(item.id)}
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Ajouter un partenaire
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {orderItems.length > 0 && (
                    <div className="border-t pt-4 mt-4 space-y-4 bg-background">
                        <div className="flex justify-between items-center text-sm px-2">
                            <span className="text-muted-foreground">Marge estimée :</span>
                            <span className={`font-bold ${totalRevenue - totalCost > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                {formatPrice(totalRevenue - totalCost)}
                            </span>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Annuler
                            </Button>
                            <Button
                                onClick={() => sendToPartnerMutation.mutate()}
                                disabled={sendToPartnerMutation.isPending || !allConfigured}
                                className="flex-1"
                            >
                                {sendToPartnerMutation.isPending ? "Envoi..." : (
                                    <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Confirmer l'envoi
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
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
