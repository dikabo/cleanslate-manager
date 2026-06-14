import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/hooks/useServices";
import { formatReportDateLabel, getRangeForQuery, ReportDateFilter } from "@/lib/reporting";

interface PaymentStatusBreakdownProps {
  dateFilter: ReportDateFilter;
}

export function PaymentStatusBreakdown({ dateFilter }: PaymentStatusBreakdownProps) {
  const { startIso, endIso } = getRangeForQuery(dateFilter);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["payment-status-breakdown", startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount, paid_amount, is_paid")
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const groups = {
      paid: { label: "Paye", count: 0, amount: 0, color: "bg-emerald-500" },
      advance: { label: "Avance", count: 0, amount: 0, color: "bg-amber-500" },
      unpaid: { label: "Non paye", count: 0, amount: 0, color: "bg-red-500" },
    };

    orders.forEach((order) => {
      if (order.is_paid) {
        groups.paid.count += 1;
        groups.paid.amount += order.total_amount || 0;
        return;
      }

      if ((order.paid_amount || 0) > 0) {
        groups.advance.count += 1;
        groups.advance.amount += (order.total_amount || 0) - (order.paid_amount || 0);
        return;
      }

      groups.unpaid.count += 1;
      groups.unpaid.amount += order.total_amount || 0;
    });

    return Object.values(groups);
  }, [orders]);

  const totalCount = stats.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-lg">Etat des commandes</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Commandes creees sur {formatReportDateLabel(dateFilter)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement des donnees...</div>
        ) : (
          <div className="space-y-4">
            {stats.map((item) => {
              const width = totalCount > 0 ? `${(item.count / totalCount) * 100}%` : "0%";

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} commande{item.count > 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatPrice(item.amount)}</p>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
