import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, User, Package, Calendar, Building, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showResults = isFocused && searchTerm.length >= 2;

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["search-clients", searchTerm],
    queryFn: async () => {
      if (!showResults) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(4);

      if (error) throw error;
      return data || [];
    },
    enabled: showResults,
  });

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["search-orders", searchTerm],
    queryFn: async () => {
      if (!showResults) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, ticket_number, created_at, article_type, custom_article_type, brand, clients(name)")
        .or(`ticket_number.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,article_type.ilike.%${searchTerm}%`)
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: showResults,
  });

  const { data: partners, isLoading: loadingPartners } = useQuery({
    queryKey: ["search-partners", searchTerm],
    queryFn: async () => {
      if (!showResults) return [];
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, specialty")
        .ilike("name", `%${searchTerm}%`)
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    enabled: showResults,
  });

  const handleSelectOrder = (orderId: string) => {
    setSearchTerm("");
    setIsFocused(false);
    navigate(`/orders?orderId=${orderId}`);
  };

  const handleSelectClient = (name: string) => {
    setSearchTerm("");
    setIsFocused(false);
    navigate(`/clients?search=${encodeURIComponent(name)}`);
  };

  const handleSelectPartner = (name: string) => {
    setSearchTerm("");
    setIsFocused(false);
    navigate(`/partners?search=${encodeURIComponent(name)}`);
  };

  const isLoading = loadingClients || loadingOrders || loadingPartners;
  const hasResults = (orders?.length || 0) > 0 || (clients?.length || 0) > 0 || (partners?.length || 0) > 0;

  return (
    <div className="flex-1 max-w-md relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={isMobile ? "Rechercher..." : "Rechercher une commande, client, article..."}
          className="pl-10 pr-8 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary h-9 md:h-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchTerm("");
              setIsFocused(true); // keep focus
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-lg border shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 max-h-[80vh] overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-sm text-center text-muted-foreground">Recherche en cours...</div>
          )}
          
          {!isLoading && !hasResults && (
            <div className="p-4 text-sm text-center text-muted-foreground">Aucun résultat trouvé pour "{searchTerm}"</div>
          )}

          {!isLoading && hasResults && (
            <div className="py-2">
              {/* Commandes Section */}
              {orders && orders.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Commandes & Articles
                  </div>
                  {orders.map((order) => {
                    const articleLabel = order.article_type ? getArticleTypeDisplayName(order.article_type, order.custom_article_type) : "";
                    const fullArticleText = [articleLabel, order.brand].filter(Boolean).join(" ");
                    
                    return (
                      <button
                        key={order.id}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted focus:bg-muted outline-none transition-colors"
                        onClick={() => handleSelectOrder(order.id)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary flex-shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm text-foreground">{order.ticket_number}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {order.clients?.name || "Client Inconnu"}
                            {fullArticleText ? ` • ${fullArticleText}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Clients Section */}
              {clients && clients.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">
                    Clients
                  </div>
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted focus:bg-muted outline-none transition-colors"
                      onClick={() => handleSelectClient(client.name)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{client.name}</div>
                        {client.phone && (
                          <div className="text-xs text-muted-foreground">{client.phone}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Partners Section */}
              {partners && partners.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">
                    Partenaires
                  </div>
                  {partners.map((partner) => (
                    <button
                      key={partner.id}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted focus:bg-muted outline-none transition-colors"
                      onClick={() => handleSelectPartner(partner.name)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">
                        <Building className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{partner.name}</div>
                        {partner.specialty && (
                          <div className="text-xs text-muted-foreground capitalize">{partner.specialty.replace('_', ' ')}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
