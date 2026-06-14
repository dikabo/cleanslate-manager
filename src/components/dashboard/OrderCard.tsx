import { Order, statusLabels, statusColors } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";
import { formatPrice } from "@/hooks/useServices";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Camera, Building } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
}

export function OrderCard({ order, onClick }: OrderCardProps) {
  const beforePhotos = order.photos?.filter(p => p.type === 'before') || [];
  const afterPhotos = order.photos?.filter(p => p.type === 'after') || [];
  const mainPhoto = beforePhotos[0]?.url;
  const afterPhoto = afterPhotos[0]?.url;

  // Check if any items are external (at partner)
  const hasExternalItems = order.order_items?.some(item => !item.is_internal);

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border shadow-card overflow-hidden cursor-pointer card-hover group"
    >
      {/* Photo Section */}
      <div className="relative h-40 bg-muted overflow-hidden">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={`${order.brand || order.article_type}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge
            className={cn(
              "font-medium shadow-sm",
              statusColors[order.status]
            )}
          >
            {statusLabels[order.status]}
          </Badge>
        </div>

        {/* External indicator */}
        {hasExternalItems && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-orange-100 text-orange-800 shadow-sm">
              <Building className="h-3 w-3 mr-1" />
              Externe
            </Badge>
          </div>
        )}

        {/* Before/After indicator */}
        {afterPhoto && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            <span className="px-2 py-1 text-xs font-medium bg-black/60 text-white rounded">
              Avant/Après ✓
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Ticket & Brand */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-primary">{order.ticket_number}</p>
            <h3 className="font-semibold text-foreground mt-0.5">
              {order.brand || getArticleTypeDisplayName(order.article_type, order.custom_article_type)}
            </h3>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {formatPrice(order.total_amount)}
          </span>
        </div>

        {/* Client */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <User className="h-4 w-4" />
          <span>{order.clients?.name || 'Client inconnu'}</span>
        </div>

        {/* Services Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {order.order_items.slice(0, 2).map((item) => (
              <span
                key={item.id}
                className={cn(
                  "px-2 py-0.5 text-xs rounded-full",
                  item.is_internal
                    ? "bg-muted text-muted-foreground"
                    : "bg-orange-50 text-orange-700"
                )}
              >
                {item.service_name}
              </span>
            ))}
            {order.order_items.length > 2 && (
              <span className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground">
                +{order.order_items.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>

          {order.is_paid ? (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
              Payé
            </Badge>
          ) : order.paid_amount > 0 ? (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
              Avance
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
              Non payé
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
