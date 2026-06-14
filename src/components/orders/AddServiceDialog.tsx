import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ServiceCategory } from "@/types";
import {
    useServices,
    serviceCategories,
    getServicesByCategoryFromList,
    getServiceDisplayName,
    formatPrice,
    isOtherService,
    DbService,
} from "@/hooks/useServices";
import { Plus, X, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { recalcOrderAmounts } from "@/hooks/useOrderMutations";

interface AddServiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    articleId: string;
    articleLabel: string;
    onSuccess?: () => void;
}

export function AddServiceDialog({
    open,
    onOpenChange,
    orderId,
    articleId,
    articleLabel,
    onSuccess,
}: AddServiceDialogProps) {
    const queryClient = useQueryClient();

    const [selectedServices, setSelectedServices] = useState<
        Array<{ service: DbService; price: number; customName?: string }>
    >([]);
    const [activeCategory, setActiveCategory] =
        useState<ServiceCategory>("cordonnerie_homme");

    const { data: dbServices = [] } = useServices();

    const resetForm = () => {
        setSelectedServices([]);
    };

    const toggleService = (service: DbService) => {
        setSelectedServices((prev) => {
            const exists = prev.find((s) => s.service.id === service.id);
            if (exists) {
                return prev.filter((s) => s.service.id !== service.id);
            }
            return [...prev, { service, price: service.base_price }];
        });
    };

    const updateServicePrice = (serviceId: string, price: number) => {
        setSelectedServices((prev) =>
            prev.map((s) =>
                s.service.id === serviceId ? { ...s, price } : s
            )
        );
    };

    const updateServiceCustomName = (serviceId: string, customName: string) => {
        setSelectedServices((prev) =>
            prev.map((s) =>
                s.service.id === serviceId ? { ...s, customName } : s
            )
        );
    };

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const hasMissingCustomName = selectedServices.some(
        (s) => isOtherService(s.service) && !s.customName?.trim()
    );

    const addServiceMutation = useMutation({
        mutationFn: async () => {
            if (selectedServices.length === 0)
                throw new Error("Sélectionnez au moins un service");
            if (hasMissingCustomName)
                throw new Error("Nommez chaque service Autres");

            // 1. Insert order_items
            const orderItems = selectedServices.map((s) => ({
                order_id: orderId,
                article_id: articleId,
                service_id: s.service.id,
                service_name: getServiceDisplayName(s.service, s.customName),
                price: s.price,
                is_internal: true,
                status: "pending" as const,
            }));

            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 2. Recalculate order amounts while preserving any discount.
            await recalcOrderAmounts(orderId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success(
                `${selectedServices.length} service(s) ajouté(s) à l'article`
            );
            resetForm();
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    const categoryServices = getServicesByCategoryFromList(
        dbServices,
        activeCategory
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) resetForm();
            }}
        >
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Ajouter un Service
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Article : <Badge variant="outline">{articleLabel}</Badge>
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Category tabs */}
                    <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(serviceCategories).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setActiveCategory(key as ServiceCategory)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                    activeCategory === key
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Services list */}
                    <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                        {categoryServices.map((service) => {
                            const isSelected = selectedServices.some(
                                (s) => s.service.id === service.id
                            );
                            return (
                                <button
                                    key={service.id}
                                    onClick={() => toggleService(service)}
                                    className={cn(
                                        "flex items-center justify-between p-2.5 rounded-lg border text-left text-sm transition-all",
                                        isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/40"
                                    )}
                                >
                                    <span>{service.name}</span>
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {formatPrice(service.base_price)}
                                    </span>
                                </button>
                            );
                        })}
                        {categoryServices.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                Aucun service dans cette catégorie
                            </p>
                        )}
                    </div>

                    {/* Selected with editable prices */}
                    {selectedServices.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">
                                Sélectionné ({selectedServices.length})
                            </Label>
                            {selectedServices.map((s) => (
                                <div
                                    key={s.service.id}
                                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-wrap"
                                >
                                    <span className="flex-1 text-sm">
                                        {getServiceDisplayName(s.service, s.customName)}
                                    </span>
                                    <Input
                                        type="number"
                                        value={s.price}
                                        onChange={(e) =>
                                            updateServicePrice(
                                                s.service.id,
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-24 h-8 text-xs"
                                    />
                                    <button
                                        onClick={() => toggleService(s.service)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                    {isOtherService(s.service) && (
                                        <Input
                                            value={s.customName || ""}
                                            onChange={(e) =>
                                                updateServiceCustomName(
                                                    s.service.id,
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Nom du service"
                                            className="basis-full h-8 text-xs"
                                        />
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-semibold text-sm">Sous-total</span>
                                <span className="font-bold text-primary">
                                    {formatPrice(totalPrice)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetForm();
                            onOpenChange(false);
                        }}
                        className="flex-1"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={() => addServiceMutation.mutate()}
                        disabled={
                            selectedServices.length === 0 ||
                            hasMissingCustomName ||
                            addServiceMutation.isPending
                        }
                        className="flex-1"
                    >
                        {addServiceMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Ajout...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter ({formatPrice(totalPrice)})
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
