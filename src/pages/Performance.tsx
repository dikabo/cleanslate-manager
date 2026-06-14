import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Star, TrendingUp, Award, Clock, Building } from "lucide-react";

const specialtyLabels: Record<string, string> = {
  cordonnerie: "Cordonnerie",
  teinture: "Teinture",
  couture: "Couture",
  nettoyage: "Nettoyage",
  reparation: "Réparation",
};

export default function Performance() {
  const { data: partners, isLoading } = useQuery({
    queryKey: ['partners-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('average_rating', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Get order items stats by partner
  const { data: partnerStats } = useQuery({
    queryKey: ['partner-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          assigned_to_partner_id,
          quality_rating,
          sent_to_partner_at,
          received_from_partner_at,
          status
        `)
        .not('assigned_to_partner_id', 'is', null);
      
      if (error) throw error;
      
      // Calculate stats per partner
      const stats: Record<string, {
        totalJobs: number;
        completedJobs: number;
        avgTurnaround: number;
        ratings: number[];
      }> = {};
      
      data.forEach(item => {
        const partnerId = item.assigned_to_partner_id;
        if (!partnerId) return;
        
        if (!stats[partnerId]) {
          stats[partnerId] = {
            totalJobs: 0,
            completedJobs: 0,
            avgTurnaround: 0,
            ratings: []
          };
        }
        
        stats[partnerId].totalJobs++;
        
        if (item.status === 'completed' || item.status === 'received_from_partner') {
          stats[partnerId].completedJobs++;
        }
        
        if (item.quality_rating) {
          stats[partnerId].ratings.push(item.quality_rating);
        }
        
        // Calculate turnaround time
        if (item.sent_to_partner_at && item.received_from_partner_at) {
          const sent = new Date(item.sent_to_partner_at);
          const received = new Date(item.received_from_partner_at);
          const days = (received.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24);
          if (stats[partnerId].avgTurnaround === 0) {
            stats[partnerId].avgTurnaround = days;
          } else {
            stats[partnerId].avgTurnaround = (stats[partnerId].avgTurnaround + days) / 2;
          }
        }
      });
      
      return stats;
    }
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-5 w-5 ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} 
      />
    ));
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1er</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2ème</Badge>;
    if (index === 2) return <Badge className="bg-amber-600">🥉 3ème</Badge>;
    return <Badge variant="outline">{index + 1}ème</Badge>;
  };

  // Calculate totals
  const totalPartners = partners?.length || 0;
  const avgRating = partners?.reduce((sum, p) => sum + (p.average_rating || 0), 0) / (totalPartners || 1);
  const totalCompletedJobs = partners?.reduce((sum, p) => sum + (p.total_orders || 0), 0) || 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Performance Partenaires
          </h1>
          <p className="text-muted-foreground">
            Analyse et classement des prestataires
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Building className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPartners}</p>
                  <p className="text-sm text-muted-foreground">Partenaires actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-100">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgRating.toFixed(1)}/5</p>
                  <p className="text-sm text-muted-foreground">Note moyenne</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCompletedJobs}</p>
                  <p className="text-sm text-muted-foreground">Prestations réalisées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-100">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {partners?.[0]?.name?.substring(0, 10) || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Meilleur partenaire</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Partner Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Classement des partenaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement...
              </div>
            ) : partners?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun partenaire enregistré
              </div>
            ) : (
              <div className="divide-y">
                {partners?.map((partner, index) => {
                  const stats = partnerStats?.[partner.id];
                  
                  return (
                    <div 
                      key={partner.id} 
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/50 -mx-4 px-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getRankBadge(index)}
                        <div>
                          <p className="font-medium text-base md:text-lg">{partner.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {specialtyLabels[partner.specialty] || partner.specialty}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 md:gap-8 ml-12 sm:ml-0">
                        {/* Rating */}
                        <div className="text-center">
                          <div className="flex items-center gap-0.5">
                            {renderStars(partner.average_rating || 0)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(partner.average_rating || 0).toFixed(1)} / 5
                          </p>
                        </div>
                        
                        {/* Stats */}
                        <div className="text-center min-w-[60px]">
                          <p className="text-lg md:text-xl font-bold text-primary">
                            {partner.total_orders || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            prestations
                          </p>
                        </div>
                        
                        {/* Turnaround */}
                        <div className="text-center min-w-[60px] hidden sm:block">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {stats?.avgTurnaround 
                                ? `${stats.avgTurnaround.toFixed(1)}j`
                                : '-'
                              }
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            délai moyen
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
