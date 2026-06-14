import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArticleType,
    Material,
    ServiceCategory,
    articleTypeLabels,
    materialLabels,
} from "@/types";
import {
    useServices,
    serviceCategories,
    getServicesByCategoryFromList,
    getServiceDisplayName,
    formatPrice,
    isOtherService,
    DbService,
} from "@/hooks/useServices";
import {
    useArticleCategories,
    useCreateArticleCategory,
    getArticleTypeDisplayName,
} from "@/hooks/useArticleCategories";
import { Plus, X, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { recalcOrderAmounts } from "@/hooks/useOrderMutations";

interface AddArticleDialogProps {
    orderId: string;
    currentArticleCount: number;
    onSuccess?: () => void;
}

export function AddArticleDialog({
    orderId,
    currentArticleCount,
    onSuccess,
}: AddArticleDialogProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    // Article fields
    const [articleType, setArticleType] = useState<ArticleType | "">("");
    const [customArticleType, setCustomArticleType] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [material, setMaterial] = useState<Material | "">("");
    const [brand, setBrand] = useState("");
    const [color, setColor] = useState("");

    // Services
    const [selectedServices, setSelectedServices] = useState<
        Array<{ service: DbService; price: number; customName?: string }>
    >([]);
    const [activeCategory, setActiveCategory] =
        useState<ServiceCategory>("cordonnerie_homme");

    const { data: dbServices = [] } = useServices();
    const { data: customCategories = [] } = useArticleCategories();
    const createCategory = useCreateArticleCategory();

    const resetForm = () => {
        setArticleType("");
        setCustomArticleType("");
        setShowCustomInput(false);
        setMaterial("");
        setBrand("");
        setColor("");
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

    const addArticleMutation = useMutation({
        mutationFn: async () => {
            if (!articleType || !material) throw new Error("Type et matière requis");
            if (articleType === "other" && !customArticleType.trim() && showCustomInput)
                throw new Error("Nom de la catégorie requis");
            if (selectedServices.length === 0)
                throw new Error("Ajoutez au moins un service");
            if (hasMissingCustomName)
                throw new Error("Nommez chaque service Autres");

            // Persist custom category if new
            const finalCustomArticleType = articleType === "other" && customArticleType.trim()
                ? customArticleType.trim()
                : articleType === "other" ? customArticleType.trim() || null : null;

            if (finalCustomArticleType) {
                await createCategory.mutateAsync(finalCustomArticleType);
            }

            // 1. Create the article
            const { data: article, error: articleError } = await supabase
                .from("order_articles")
                .insert({
                    order_id: orderId,
                    article_type: articleType,
                    custom_article_type: finalCustomArticleType,
                    material: material,
                    brand: brand || null,
                    position: currentArticleCount + 1,
                })
                .select()
                .single();

            if (articleError) throw articleError;

            // 2. Create order_items for each selected service
            const orderItems = selectedServices.map((s) => ({
                order_id: orderId,
                article_id: article.id,
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

            // 3. Recalculate order amounts while preserving any discount.
            await recalcOrderAmounts(orderId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Article ajouté à la commande");
            resetForm();
            setOpen(false);
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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Ajouter un article
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Ajouter un Article
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Article Type & Material */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Type d'article *</Label>
                            <Select
                                value={showCustomInput ? "__new__" : (articleType === "other" && customArticleType ? `custom:${customArticleType}` : articleType)}
                                onValueChange={(v) => {
                                    if (v === "__new__") {
                                        setArticleType("other" as ArticleType);
                                        setCustomArticleType("");
                                        setShowCustomInput(true);
                                    } else if (v.startsWith("custom:")) {
                                        setArticleType("other" as ArticleType);
                                        setCustomArticleType(v.replace("custom:", ""));
                                        setShowCustomInput(false);
                                    } else {
                                        setArticleType(v as ArticleType);
                                        setCustomArticleType("");
                                        setShowCustomInput(false);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(articleTypeLabels)
                                        .filter(([key]) => key !== "other")
                                        .map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                    {customCategories.length > 0 && (
                                        <>
                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Catégories personnalisées</div>
                                            {customCategories.map((cat) => (
                                                <SelectItem key={cat.id} value={`custom:${cat.name}`}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </>
                                    )}
                                    <div className="px-2 py-1.5 border-t" />
                                    <SelectItem value="__new__">
                                        <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Autre (nouvelle catégorie)</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {showCustomInput && (
                                <Input
                                    value={customArticleType}
                                    onChange={(e) => setCustomArticleType(e.target.value)}
                                    placeholder="Nom de la catégorie (ex: Chapeau, Montre...)"
                                    className="mt-1.5 h-8 text-xs"
                                    autoFocus
                                />
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Matière *</Label>
                            <Select
                                value={material}
                                onValueChange={(v) => setMaterial(v as Material)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(materialLabels).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Marque</Label>
                            <Input
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                placeholder="Ex: Nike, Gucci..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Couleur</Label>
                            <Input
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="Ex: Noir, Marron..."
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Service Selection */}
                    <div>
                        <Label className="text-xs font-semibold">Services *</Label>

                        {/* Category tabs */}
                        <div className="flex gap-1.5 mt-2 mb-3 flex-wrap">
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
                        <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
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
                    </div>

                    {/* Selected services with editable prices */}
                    {selectedServices.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">
                                Services sélectionnés ({selectedServices.length})
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
                                <span className="font-semibold text-sm">Total article</span>
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
                        onClick={() => { resetForm(); setOpen(false); }}
                        className="flex-1"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={() => addArticleMutation.mutate()}
                        disabled={
                            !articleType ||
                            !material ||
                            selectedServices.length === 0 ||
                            hasMissingCustomName ||
                            addArticleMutation.isPending
                        }
                        className="flex-1"
                    >
                        {addArticleMutation.isPending ? (
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
