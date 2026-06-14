import { Order, OrderStatus, statusLabels, statusColors } from "@/types";
import { OrderCard } from "./OrderCard";
import { cn } from "@/lib/utils";

interface StatusColumnProps {
  status: OrderStatus;
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}

export function StatusColumn({ status, orders, onOrderClick }: StatusColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] md:min-w-[320px] md:max-w-[320px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 px-2">
        <div
          className={cn(
            "w-3 h-3 rounded-full",
            status === 'received' && "bg-blue-500",
            status === 'validated' && "bg-purple-500",
            status === 'sent_to_partner' && "bg-orange-500",
            status === 'received_from_partner' && "bg-cyan-500",
            status === 'ready' && "bg-emerald-500",
            status === 'delivered' && "bg-gray-400"
          )}
        />
        <h3 className="font-semibold text-foreground">
          {statusLabels[status]}
        </h3>
        <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4 overflow-y-auto pb-4 scrollbar-thin">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={() => onOrderClick?.(order)}
          />
        ))}

        {orders.length === 0 && (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">Aucune commande</p>
          </div>
        )}
      </div>
    </div>
  );
}
