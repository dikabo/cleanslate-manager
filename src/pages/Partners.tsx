import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Partner } from "@/types";
import { PartnerCard } from "@/components/partners/PartnerCard";
import { CreatePartnerDialog } from "@/components/partners/CreatePartnerDialog";
import { PartnerProfileSheet } from "@/components/partners/PartnerProfileSheet";

export default function Partners() {
  const { isAdminOrManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const { data: partners, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .limit(50);

      if (error) throw error;
      return data as Partner[];
    }
  });

  const filteredPartners = partners?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Partenaires
            </h1>
            <p className="text-muted-foreground">
              Gestion des prestataires externes
            </p>
          </div>

          {isAdminOrManager && <CreatePartnerDialog />}
        </div>

        {/* Search */}
        <Input
          placeholder="Rechercher un partenaire..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />

        {/* Partners Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement des partenaires...
          </div>
        ) : filteredPartners?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Aucun partenaire trouvé
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPartners?.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onClick={() => setSelectedPartner(partner)}
              />
            ))}
          </div>
        )}
      </div>

      <PartnerProfileSheet
        partner={selectedPartner}
        open={!!selectedPartner}
        onClose={() => setSelectedPartner(null)}
      />
    </AppLayout>
  );
}
