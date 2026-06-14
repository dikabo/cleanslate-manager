import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusColumn } from "@/components/dashboard/StatusColumn";
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Order, OrderStatus } from "@/types";
import {
  Package,
  ClipboardCheck,
  Clock,
  Wallet,
  Building,
} from "lucide-react";
import { formatPrice } from "@/hooks/useServices";
import { supabase } from "@/integrations/supabase/client";

const statusOrder: OrderStatus[] = [
  "received",
  "validated",
  "sent_to_partner",
  "received_from_partner",
  "ready",
];

export default function Dashboard() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch all active orders (not delivered)
  const { data: orders = [], isLoading, error: ordersError } = useQuery({
    queryKey: ['dashboard-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
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
        .neq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    }
  });

  // Fetch items currently at partners
  const { data: itemsAtPartners = [], error: itemsError } = useQuery({
    queryKey: ['items-at-partners-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('id')
        .in('status', ['sent_to_partner', 'at_partner'])
        .not('assigned_to_partner_id', 'is', null);

      if (error) throw error;
      return data;
    }
  });

  // Fetch current month revenue (includes delivered orders)
  const { data: revenueAmount = 0, error: revenueError } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await supabase
        .from('orders')
        .select('paid_amount')
        .gte('created_at', startOfMonth.toISOString());

      if (error) throw error;
      return data.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    }
  });

  // Calculate stats
  const today = new Date().toDateString();
  const todayOrders = orders.filter(
    (o) => new Date(o.created_at).toDateString() === today
  );

  const stats = {
    todayCount: todayOrders.length,
    inProgress: orders.filter((o) => !['delivered', 'ready'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'ready').length,
    revenue: revenueAmount,
    atPartners: itemsAtPartners.length,
  };

  const ordersByStatus = statusOrder.reduce((acc, status) => {
    acc[status] = orders.filter((o) => o.status === status);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Tableau de Bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenue ! Voici l'aperçu de votre atelier aujourd'hui.
          </p>
        </div>

        {(ordersError || itemsError || revenueError) && (
          <Alert variant="destructive">
            <AlertTitle>Chargement du tableau de bord incomplet</AlertTitle>
            <AlertDescription>
              Certaines donnees n&apos;ont pas pu etre chargees. Verifie la connexion internet,
              la session ou les droits d&apos;acces.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
          <StatCard
            title="Commandes du jour"
            value={stats.todayCount}
            subtitle="nouvelles entrées"
            icon={Package}
            variant="primary"
          />
          <StatCard
            title="En cours"
            value={stats.inProgress}
            subtitle="articles en traitement"
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Prêts à livrer"
            value={stats.ready}
            subtitle="en attente client"
            icon={ClipboardCheck}
            variant="success"
          />
          <StatCard
            title="Chez Partenaires"
            value={stats.atPartners}
            subtitle="articles externes"
            icon={Building}
          />
          <StatCard
            title="Chiffre d'affaires"
            value={formatPrice(stats.revenue)}
            subtitle="ce mois"
            icon={Wallet}
          />
        </div>

        {/* Kanban Board */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Suivi des Commandes
            </h2>
            <p className="text-sm text-muted-foreground">
              {orders.length} commandes actives
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Chargement des commandes...
            </div>
          ) : (
            <div className="overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
              <div className="flex gap-4 md:gap-6">
                {statusOrder.map((status) => (
                  <StatusColumn
                    key={status}
                    status={status}
                    orders={ordersByStatus[status]}
                    onOrderClick={setSelectedOrder}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        order={orders.find(o => o.id === selectedOrder?.id) || selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </AppLayout>
  );
}
