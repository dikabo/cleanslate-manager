import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { OrderCard } from "@/components/dashboard/OrderCard";
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";
import { Order, OrderStatus, statusLabels } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Search, Filter, LayoutGrid, List, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type PaymentStatusFilter = "all" | "advance" | "paid" | "unpaid";
type OrderStatusFilter = OrderStatus | "all" | "in_progress";
type ListSortOption =
  | "created_desc"
  | "created_asc"
  | "last_step_desc"
  | "last_step_asc";

const PAGE_SIZE = 24;

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("in_progress");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [listSort, setListSort] = useState<ListSortOption>("created_desc");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          ticket_number,
          client_id,
          article_type,
          brand,
          material,
          status,
          total_amount,
          paid_amount,
          is_paid,
          created_at,
          updated_at,
          estimated_date,
          delivered_at,
          clients (name),
          order_items (
            id,
            service_name,
            is_internal
          ),
          photos (
            url,
            type
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesSearch =
          order.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.brand?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "in_progress"
              ? order.status !== "delivered"
              : order.status === statusFilter;

        const paymentStatus = order.is_paid
          ? "paid"
          : order.paid_amount > 0
            ? "advance"
            : "unpaid";

        const matchesPayment =
          paymentFilter === "all" || paymentStatus === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
      }),
    [orders, searchQuery, statusFilter, paymentFilter]
  );

  const sortedOrders = useMemo(() => {
    const items = [...filteredOrders];

    return items.sort((a, b) => {
      const createdA = new Date(a.created_at).getTime();
      const createdB = new Date(b.created_at).getTime();
      const lastStepA = new Date(a.delivered_at ?? a.updated_at ?? a.created_at).getTime();
      const lastStepB = new Date(b.delivered_at ?? b.updated_at ?? b.created_at).getTime();

      switch (listSort) {
        case "created_asc":
          return createdA - createdB;
        case "last_step_desc":
          return lastStepB - lastStepA;
        case "last_step_asc":
          return lastStepA - lastStepB;
        case "created_desc":
        default:
          return createdB - createdA;
      }
    });
  }, [filteredOrders, listSort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, paymentFilter, viewMode, listSort]);

  // Handle URL param 'orderId' to auto-open the sheet
  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (orderIdParam && orders.length > 0) {
      const order = orders.find(o => o.id === orderIdParam);
      if (order) {
        setSelectedOrder(order);
        // Clear the param from URL once opened
        setSearchParams(prev => {
          prev.delete("orderId");
          return prev;
        });
      }
    }
  }, [searchParams, orders, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedOrders = sortedOrders.slice(
    (currentPageSafe - 1) * PAGE_SIZE,
    currentPageSafe * PAGE_SIZE
  );

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, currentPageSafe - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, index) => adjustedStart + index
    );
  }, [currentPageSafe, totalPages]);

  const getRelevantDate = (order: Order) => {
    if (listSort === "last_step_desc" || listSort === "last_step_asc") {
      return {
        label: order.delivered_at ? "Livree le" : "Derniere etape",
        value: order.delivered_at ?? order.updated_at ?? order.created_at,
      };
    }

    return {
      label: "Creee le",
      value: order.created_at,
    };
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Commandes
            </h1>
            <p className="text-muted-foreground mt-1">
              Gere toutes vos commandes en un seul endroit
            </p>
          </div>
          <Link to="/orders/new">
            <Button className="touch-target">
              <Plus className="h-5 w-5 mr-2" />
              Nouvelle Commande
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par ticket, client, marque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as OrderStatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={paymentFilter}
              onValueChange={(value) => setPaymentFilter(value as PaymentStatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Paiement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous paiements</SelectItem>
                <SelectItem value="advance">Avance</SelectItem>
                <SelectItem value="paid">Paye</SelectItem>
                <SelectItem value="unpaid">Non paye</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className={cn("rounded-none", viewMode === "grid" && "bg-muted")}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("rounded-none", viewMode === "list" && "bg-muted")}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredOrders.length} commande{filteredOrders.length > 1 ? "s" : ""} trouvee
          {filteredOrders.length > 1 ? "s" : ""}
        </p>

        {!isLoading && viewMode === "list" && (
          <div className="flex justify-end">
            <Select
              value={listSort}
              onValueChange={(value) => setListSort(value as ListSortOption)}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Ordre d'affichage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Creation: recentes d'abord</SelectItem>
                <SelectItem value="created_asc">Creation: anciennes d'abord</SelectItem>
                <SelectItem value="last_step_desc">Derniere etape: recentes d'abord</SelectItem>
                <SelectItem value="last_step_asc">Derniere etape: anciennes d'abord</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Chargement des commandes impossible</AlertTitle>
            <AlertDescription>
              Les donnees des commandes n&apos;ont pas pu etre chargees. Verifie la connexion internet,
              la session ou les droits d&apos;acces. Detail: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des commandes...
          </div>
        )}

        {!isLoading && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}

        {!isLoading && viewMode === "list" && (
          <div className="space-y-3">
            {paginatedOrders.map((order) => {
              const beforePhotos = order.photos?.filter((photo) => photo.type === "before") || [];

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center gap-4 p-4 bg-card border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                >
                  {beforePhotos[0] ? (
                    <img
                      src={beforePhotos[0].url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                      <Camera className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {order.ticket_number}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium truncate">{order.brand}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {order.clients?.name || "Client inconnu"}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "inline-block px-2 py-1 text-xs font-medium rounded-full",
                        order.status === "ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {statusLabels[order.status]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {(() => {
                        const relevantDate = getRelevantDate(order);
                        return `${relevantDate.label} ${format(new Date(relevantDate.value), "dd/MM/yyyy HH:mm", {
                          locale: fr,
                        })}`;
                      })()}
                    </span>
                    {order.is_paid ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                        Paye
                      </Badge>
                    ) : order.paid_amount > 0 ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                        Avance
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                        Non paye
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune commande trouvee</p>
          </div>
        )}

        {!isLoading && sortedOrders.length > PAGE_SIZE && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPageSafe > 1) setCurrentPage(currentPageSafe - 1);
                  }}
                  className={currentPageSafe === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {pageNumbers.map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPageSafe}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPageSafe < totalPages) setCurrentPage(currentPageSafe + 1);
                  }}
                  className={currentPageSafe === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <OrderDetailSheet
        order={orders.find((order) => order.id === selectedOrder?.id) || selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </AppLayout>
  );
}
