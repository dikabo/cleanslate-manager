import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/hooks/useServices";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    formatBucketKey,
    formatReportDateLabel,
    getChartBuckets,
    getPeriodComparisonLabel,
    getRangeForQuery,
    getReportGranularity,
    getSignedPaymentAmount,
    ReportDateFilter,
} from "@/lib/reporting";

interface RevenueChartProps {
    dateFilter: ReportDateFilter;
}

export function RevenueChart({ dateFilter }: RevenueChartProps) {
    const { startIso, endIso } = getRangeForQuery(dateFilter);
    const granularity = getReportGranularity(dateFilter);

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ["revenue-orders", startIso, endIso],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("total_amount, paid_amount, is_paid, created_at")
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const { data: payments = [], isLoading: isLoadingPayments } = useQuery({
        queryKey: ["revenue-payments", startIso, endIso],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payments")
                .select("amount, payment_type, created_at")
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const chartData = useMemo(() => {
        const buckets = getChartBuckets(dateFilter, granularity);

        return buckets.map((bucket) => {
            const bucketOrders = orders.filter(
                (order) => formatBucketKey(order.created_at, granularity) === bucket.key
            );
            const bucketPayments = payments.filter(
                (payment) => formatBucketKey(payment.created_at, granularity) === bucket.key
            );

            return {
                label: bucket.label,
                ca: bucketOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
                paid: bucketPayments.reduce((sum, payment) => sum + getSignedPaymentAmount(payment), 0),
                count: bucketOrders.length,
            };
        });
    }, [dateFilter, granularity, orders, payments]);

    const totalCA = chartData.reduce((s, d) => s + d.ca, 0);
    const totalPaid = chartData.reduce((s, d) => s + d.paid, 0);
    const totalOrders = chartData.reduce((s, d) => s + d.count, 0);
    const avgPerOrder = totalOrders > 0 ? totalCA / totalOrders : 0;

    // Trend: compare to first half vs second half
    const halfIdx = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, halfIdx).reduce((s, d) => s + d.ca, 0);
    const secondHalf = chartData.slice(halfIdx).reduce((s, d) => s + d.ca, 0);
    const trend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium mb-1">{label}</p>
                <p className="text-primary">CA: {formatPrice(payload[0]?.value || 0)}</p>
                {payload[1] && (
                    <p className="text-emerald-600">Encaissé: {formatPrice(payload[1]?.value || 0)}</p>
                )}
            </div>
        );
    };

    if (isLoading || isLoadingPayments) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Chargement des donnees...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Chiffre d'Affaires</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatReportDateLabel(dateFilter)} • {getPeriodComparisonLabel(dateFilter)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                        {trend > 5 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : trend < -5 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                            <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span
                            className={cn(
                                "font-medium",
                                trend > 5 ? "text-emerald-600" : trend < -5 ? "text-red-600" : "text-muted-foreground"
                            )}
                        >
                            {trend > 0 ? "+" : ""}
                            {trend.toFixed(0)}%
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground">CA Total</p>
                        <p className="text-lg font-bold">{formatPrice(totalCA)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Encaissé</p>
                        <p className="text-lg font-bold text-emerald-600">{formatPrice(totalPaid)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Panier moyen</p>
                        <p className="text-lg font-bold">{formatPrice(avgPerOrder)}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="ca" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                            <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.6} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
