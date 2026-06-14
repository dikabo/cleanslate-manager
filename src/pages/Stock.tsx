import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Package,
  AlertTriangle,
  Plus,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StockItem {
  id: string;
  name: string;
  category: "consumable" | "product";
  quantity: number;
  min_threshold: number;
  unit: string;
  price: number | null;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

function CreateStockItemDialog() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"consumable" | "product">("consumable");
  const [quantity, setQuantity] = useState(0);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unit, setUnit] = useState("unité");
  const [price, setPrice] = useState<number | undefined>();
  const [supplier, setSupplier] = useState("");

  const resetForm = () => {
    setName("");
    setCategory("consumable");
    setQuantity(0);
    setMinThreshold(5);
    setUnit("unité");
    setPrice(undefined);
    setSupplier("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_items").insert({
        name,
        category,
        quantity,
        min_threshold: minThreshold,
        unit,
        price: price ?? null,
        supplier: supplier || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_items"] });
      toast.success("Article ajouté au stock");
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="touch-target">
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un article
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un article au stock</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'article"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as "consumable" | "product")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumable">Consommable</SelectItem>
                  <SelectItem value="product">Produit à la vente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Seuil minimum</Label>
              <Input
                type="number"
                value={minThreshold}
                onChange={(e) => setMinThreshold(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="unité"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prix (FCFA)</Label>
              <Input
                type="number"
                value={price ?? ""}
                onChange={(e) =>
                  setPrice(e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="Optionnel"
              />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!name || createMutation.isPending}
          >
            {createMutation.isPending ? "Création..." : "Ajouter l'article"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Stock() {
  const queryClient = useQueryClient();

  const {
    data: stockItems = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stock_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as StockItem[];
    },
  });

  const adjustQuantityMutation = useMutation({
    mutationFn: async ({
      id,
      newQuantity,
    }: {
      id: string;
      newQuantity: number;
    }) => {
      const { error } = await supabase
        .from("stock_items")
        .update({ quantity: Math.max(0, newQuantity) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_items"] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const consumables = stockItems.filter((i) => i.category === "consumable");
  const products = stockItems.filter((i) => i.category === "product");
  const lowStockItems = consumables.filter(
    (item) => item.quantity <= item.min_threshold
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-destructive">
          Erreur de chargement des stocks: {(error as Error).message}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Gestion des Stocks
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivez vos consommables et produits à la vente
            </p>
          </div>
          <CreateStockItemDialog />
        </div>

        {/* Alerts */}
        {lowStockItems.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800">
                    Stock faible sur {lowStockItems.length} article
                    {lowStockItems.length > 1 ? "s" : ""}
                  </h3>
                  <p className="text-sm text-amber-700 mt-1">
                    {lowStockItems.map((item) => item.name).join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {stockItems.length === 0 && (
          <Card>
            <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-foreground mb-1">
                Aucun article en stock
              </h3>
              <p className="text-sm text-muted-foreground">
                Commencez par ajouter vos premiers articles de stock.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        {stockItems.length > 0 && (
          <Tabs defaultValue="consumables" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="consumables" className="touch-target">
                Consommables ({consumables.length})
              </TabsTrigger>
              <TabsTrigger value="products" className="touch-target">
                Produits ({products.length})
              </TabsTrigger>
            </TabsList>

            {/* Consumables Tab */}
            <TabsContent value="consumables" className="space-y-4">
              {consumables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun consommable enregistré.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {consumables.map((item) => {
                    const stockPercentage =
                      (item.quantity / (item.min_threshold * 2)) * 100;
                    const isLow = item.quantity <= item.min_threshold;

                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          "card-hover",
                          isLow && "border-amber-200"
                        )}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <Badge variant="secondary" className="mb-2">
                                {item.supplier || "Consommable"}
                              </Badge>
                              <h3 className="font-semibold text-foreground">
                                {item.name}
                              </h3>
                            </div>
                            {isLow && (
                              <TrendingDown className="h-5 w-5 text-amber-500" />
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Stock actuel
                              </span>
                              <span
                                className={cn(
                                  "font-semibold",
                                  isLow
                                    ? "text-amber-600"
                                    : "text-foreground"
                                )}
                              >
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(stockPercentage, 100)}
                              className={cn(
                                "h-2",
                                isLow && "[&>div]:bg-amber-500"
                              )}
                            />
                            <p className="text-xs text-muted-foreground">
                              Seuil minimum: {item.min_threshold} {item.unit}
                            </p>
                          </div>

                          {/* Quantity adjustment */}
                          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={
                                item.quantity <= 0 ||
                                adjustQuantityMutation.isPending
                              }
                              onClick={() =>
                                adjustQuantityMutation.mutate({
                                  id: item.id,
                                  newQuantity: item.quantity - 1,
                                })
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold text-lg w-12 text-center">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={adjustQuantityMutation.isPending}
                              onClick={() =>
                                adjustQuantityMutation.mutate({
                                  id: item.id,
                                  newQuantity: item.quantity + 1,
                                })
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-4">
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun produit enregistré.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((item) => (
                    <Card key={item.id} className="card-hover">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <Badge variant="secondary" className="mb-2">
                              {item.supplier || "Produit"}
                            </Badge>
                            <h3 className="font-semibold text-foreground">
                              {item.name}
                            </h3>
                          </div>
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold text-foreground">
                              {item.quantity}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              en stock
                            </p>
                          </div>
                          <div className="text-right">
                            {item.price != null && (
                              <>
                                <p className="font-semibold text-primary">
                                  {new Intl.NumberFormat("fr-FR").format(
                                    item.price
                                  )}{" "}
                                  FCFA
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  prix unitaire
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quantity adjustment */}
                        <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={
                              item.quantity <= 0 ||
                              adjustQuantityMutation.isPending
                            }
                            onClick={() =>
                              adjustQuantityMutation.mutate({
                                id: item.id,
                                newQuantity: item.quantity - 1,
                              })
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-semibold text-lg w-12 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={adjustQuantityMutation.isPending}
                            onClick={() =>
                              adjustQuantityMutation.mutate({
                                id: item.id,
                                newQuantity: item.quantity + 1,
                              })
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
