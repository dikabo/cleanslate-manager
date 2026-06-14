import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Phone, Mail, MapPin, Building, Users } from "lucide-react";
import { Partner, PartnerSpecialty, specialtyLabels } from "@/types";
import { cn } from "@/lib/utils";

const specialtyColors: Record<string, string> = {
  cordonnerie: "bg-amber-100 text-amber-800",
  teinture: "bg-purple-100 text-purple-800",
  couture: "bg-pink-100 text-pink-800",
  nettoyage: "bg-blue-100 text-blue-800",
  reparation: "bg-green-100 text-green-800",
};

interface PartnerCardProps {
  partner: Partner;
  onClick?: () => void;
}

export function PartnerCard({ partner, onClick }: PartnerCardProps) {
  const displaySpecialties = partner.specialties && partner.specialties.length > 0
    ? partner.specialties
    : [partner.specialty];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick ? "cursor-pointer hover:shadow-md hover:border-primary/50 active:scale-[0.98]" : ""
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3 pointer-events-none">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {partner.name}
            </CardTitle>
            <div className="flex flex-wrap gap-1 mt-2">
              {displaySpecialties.map((spec) => (
                <Badge
                  key={spec}
                  variant="secondary"
                  className={cn(
                    "text-[10px] py-0",
                    specialtyColors[spec] || "bg-gray-100 text-gray-800"
                  )}
                >
                  {specialtyLabels[spec as PartnerSpecialty] || spec}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {renderStars(partner.average_rating || 0)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {partner.contact_name && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{partner.contact_name}</span>
          </div>
        )}
        {partner.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{partner.phone}</span>
          </div>
        )}
        {partner.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{partner.email}</span>
          </div>
        )}
        {partner.city && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{partner.city}</span>
          </div>
        )}

        <div className="pt-2 border-t space-y-2 pointer-events-none">
          {(partner.active_items_count ?? 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-700 font-medium">Articles en cours</span>
              <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 font-bold">
                {partner.active_items_count}
              </Badge>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Commandes traitées</span>
            <Badge variant="secondary">{partner.total_orders || 0}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
