import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Client, OrderStatus, statusLabels, statusColors } from "@/types";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Phone,
    Mail,
    MapPin,
    Star,
    ShoppingBag,
    DollarSign,
    Package,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";

const supabaseLoose = supabase as any;

interface ClientDetailsSheetProps {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNewOrder: (clientId: string) => void;
    onClientUpdated: (client: Client) => void;
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XAF",
        maximumFractionDigits: 0,
    }).format(price);
};

export function ClientDetailsSheet({
    client,
    open,
    onOpenChange,
    onNewOrder,
    onClientUpdated,
}: ClientDetailsSheetProps) {
    const [statsPeriod, setStatsPeriod] = useState<"all" | "month" | "year">("all");

    const { data: loyaltySummary } = useQuery({
        queryKey: ["client-loyalty-summary", client?.id],
        queryFn: async () => {
            if (!client) return null;

            const { data, error } = await supabaseLoose
                .from("client_loyalty_summary")
                .select("*")
                .eq("client_id", client.id)
                .maybeSingle();

            if (error) return null;
            return data as {
                legacy_orders_count: number;
                legacy_revenue: number;
                total_known_orders: number;
                total_known_revenue: number;
                last_activity_date: string | null;
                loyalty_tier: string;
                loyalty_segment: string;
            } | null;
        },
        enabled: !!client,
    });

    const { data: clientStats, isLoading } = useQuery({
        queryKey: ["client-stats", client?.id],
        queryFn: async () => {
            if (!client) return null;

            const { data: ordersData, error } = await supabase
                .from("orders")
                .select(`
          id,
          ticket_number,
          status,
          total_amount,
          created_at,
          order_articles (id),
          order_items (id, is_internal)
        `)
                .eq("client_id", client.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            let totalRevenue = 0;
            let totalArticles = 0;
            let totalServices = 0;

            const ordersList = ordersData.map((order: any) => {
                totalRevenue += order.total_amount || 0;
                totalArticles += order.order_articles?.length || 0;
                totalServices += order.order_items?.length || 0;

                return {
                    id: order.id,
                    ticket_number: order.ticket_number,
                    status: order.status as OrderStatus,
                    total_amount: order.total_amount,
                    created_at: order.created_at,
                    articles_count: order.order_articles?.length || 0,
                    services_count: order.order_items?.length || 0,
                };
            });

            return {
                orders: ordersList,
                totalRevenue,
                totalArticles,
                totalServices,
            };
        },
        enabled: !!client,
    });

    const filteredStats = (() => {
        if (!clientStats) return null;
        if (statsPeriod === "all") return clientStats;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const filteredOrders = clientStats.orders.filter((order) => {
            const orderDate = new Date(order.created_at);
            if (statsPeriod === "year") {
                return orderDate.getFullYear() === currentYear;
            }
            if (statsPeriod === "month") {
                return orderDate.getFullYear() === currentYear && orderDate.getMonth() === currentMonth;
            }
            return true;
        });

        let totalRevenue = 0;
        let totalArticles = 0;
        let totalServices = 0;

        filteredOrders.forEach((order) => {
            totalRevenue += order.total_amount || 0;
            totalArticles += order.articles_count || 0;
            totalServices += order.services_count || 0;
        });

        return {
            orders: filteredOrders,
            totalRevenue,
            totalArticles,
            totalServices,
        };
    })();

    if (!client) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-background p-0">
                <div className="p-6 pb-2 border-b">
                    <SheetHeader>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                                    {client.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <SheetTitle className="text-xl">{client.name}</SheetTitle>
                                <p className="text-sm text-muted-foreground">
                                    Client depuis{" "}
                                    {format(new Date(client.created_at), "MMMM yyyy", { locale: fr })}
                                </p>
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4 border-b">
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="info">Infos</TabsTrigger>
                            <TabsTrigger value="stats">Statistiques</TabsTrigger>
                            <TabsTrigger value="history">Historique</TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 pb-24">
                            <TabsContent value="info" className="mt-0 space-y-6">
                                <div className="space-y-3">
                                    <h4 className="font-semibold text-sm">Coordonnees</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                            <Phone className="h-5 w-5 text-muted-foreground" />
                                            <span>{client.phone}</span>
                                        </div>
                                        {client.email && (
                                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                                <Mail className="h-5 w-5 text-muted-foreground" />
                                                <span>{client.email}</span>
                                            </div>
                                        )}
                                        {client.address && (
                                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                                <span>{client.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {client.preferences && (
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">Preferences</h4>
                                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                            {client.preferences}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="stats" className="mt-0 space-y-6">
                                {isLoading ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Chargement des statistiques...
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
                                            <span className="text-sm font-medium pl-2">Periode</span>
                                            <Select value={statsPeriod} onValueChange={(value: "all" | "month" | "year") => setStatsPeriod(value)}>
                                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Tout le temps</SelectItem>
                                                    <SelectItem value="year">Cette annee</SelectItem>
                                                    <SelectItem value="month">Ce mois-ci</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <DollarSign className="h-5 w-5 text-primary" />
                                                    <span className="text-sm text-muted-foreground">CA {statsPeriod === "all" ? "Total" : "Periode"}</span>
                                                </div>
                                                <p className="text-2xl font-bold text-foreground">
                                                    {formatPrice(filteredStats?.totalRevenue || 0)}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-muted/50 rounded-lg flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground">Commandes</span>
                                                </div>
                                                <p className="text-2xl font-bold text-foreground">
                                                    {filteredStats?.orders?.length || 0}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-muted/50 rounded-lg flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Package className="h-5 w-5 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground">Articles</span>
                                                </div>
                                                <p className="text-2xl font-bold text-foreground">
                                                    {filteredStats?.totalArticles || 0}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-muted/50 rounded-lg flex flex-col">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Star className="h-5 w-5 text-amber-500" />
                                                    <span className="text-sm text-muted-foreground">Points</span>
                                                </div>
                                                <p className="text-2xl font-bold text-foreground">
                                                    {client.loyalty_points}
                                                </p>
                                            </div>
                                        </div>
                                        {loyaltySummary && (
                                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-amber-900">Fidelite enrichie</p>
                                                        <p className="text-xs text-amber-700">
                                                            Inclut les transactions importees depuis Excel
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="bg-white">
                                                        {loyaltySummary.loyalty_tier}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs text-amber-700">CA historique</p>
                                                        <p className="font-semibold">{formatPrice(loyaltySummary.legacy_revenue || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-amber-700">Commandes historiques</p>
                                                        <p className="font-semibold">{loyaltySummary.legacy_orders_count || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-amber-700">CA total connu</p>
                                                        <p className="font-semibold">{formatPrice(loyaltySummary.total_known_revenue || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-amber-700">Derniere activite</p>
                                                        <p className="font-semibold">{loyaltySummary.last_activity_date || "-"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 space-y-4">
                                {isLoading ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Chargement de l'historique...
                                    </div>
                                ) : clientStats?.orders && clientStats.orders.length > 0 ? (
                                    <div className="space-y-3">
                                        {clientStats.orders.map((order) => (
                                            <div key={order.id} className="p-3 bg-muted/30 rounded-lg border flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-sm">{order.ticket_number}</span>
                                                        <Badge variant="outline" className={`text-xs ${statusColors[order.status]}`}>
                                                            {statusLabels[order.status]}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(order.created_at), "dd MMM yyyy", { locale: fr })} • {order.articles_count} article{order.articles_count > 1 ? "s" : ""}
                                                    </p>
                                                </div>
                                                <div className="font-medium text-sm">
                                                    {formatPrice(order.total_amount || 0)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Aucune commande pour le moment
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
                    <div className="flex gap-3">
                        <Button
                            className="flex-1 touch-target"
                            onClick={() => {
                                onOpenChange(false);
                                onNewOrder(client.id);
                            }}
                        >
                            Nouvelle Commande
                        </Button>
                        <CreateClientDialog
                            client={client}
                            onSuccess={onClientUpdated}
                            trigger={
                                <Button variant="outline" className="touch-target">
                                    Modifier
                                </Button>
                            }
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
