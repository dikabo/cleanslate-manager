import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Client } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Star,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { ClientDetailsSheet } from "@/components/clients/ClientDetailsSheet";
import { toast } from "sonner";

export default function Clients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  type ClientWithStats = Client & { hasActiveOrders?: boolean; activeOrdersCount?: number };
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);

  const { data: clients = [], isLoading } = useQuery<ClientWithStats[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          orders(status)
        `)
        .order('name');

      if (error) throw error;

      return data.map(client => {
        const activeOrdersList = client.orders?.filter((o: any) => o.status !== 'delivered') || [];
        return {
          ...client,
          hasActiveOrders: activeOrdersList.length > 0,
          activeOrdersCount: activeOrdersList.length
        };
      }) as ClientWithStats[];
    }
  });

  const filteredClients = useMemo(() => clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone.includes(searchQuery) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [clients, searchQuery]);

  // Handle URL param 'search'
  useEffect(() => {
    const searchParam = searchParams.get("search");
    if (searchParam) {
      setSearchQuery(searchParam);
      setSearchParams(prev => {
        prev.delete("search");
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Clients
            </h1>
            <p className="text-muted-foreground mt-1">
              {clients.length} clients enregistrés
            </p>
          </div>
          <CreateClientDialog />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, téléphone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des clients...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer card-hover"
                onClick={() => setSelectedClient(client)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {client.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {client.name}
                        </h3>
                        {client.hasActiveOrders && (
                          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 whitespace-nowrap shrink-0">
                            {client.activeOrdersCount} en cours
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.phone}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">
                        {client.loyalty_points} pts
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {client.orders_count} commande{client.orders_count > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun client trouvé</p>
          </div>
        )}
      </div>

      {/* Client Detail Sheet */}
      <ClientDetailsSheet
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        onNewOrder={(clientId) => {
          navigate(`/orders/new?clientId=${clientId}`);
        }}
        onClientUpdated={(updatedClient) => {
          setSelectedClient((current) => current ? { ...current, ...updatedClient } : updatedClient);
        }}
      />
    </AppLayout>
  );
}
