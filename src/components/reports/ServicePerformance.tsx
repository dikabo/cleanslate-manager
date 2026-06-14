import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/hooks/useServices";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { Wrench } from "lucide-react";
import {
    formatReportDateLabel,
    getRangeForQuery,
    ReportDateFilter,
} from "@/lib/reporting";

const COLORS = [
    "hsl(221, 83%, 53%)",  // blue
    "hsl(142, 71%, 45%)",  // green
    "hsl(262, 83%, 58%)",  // purple
    "hsl(24, 95%, 53%)",   // orange
    "hsl(346, 77%, 50%)",  // red
    "hsl(197, 71%, 50%)",  // cyan
    "hsl(43, 96%, 56%)",   // yellow
    "hsl(326, 78%, 60%)",  // pink
];

interface ServicePerformanceProps {
    dateFilter: ReportDateFilter;
}

export function ServicePerformance({ dateFilter }: ServicePerformanceProps) {
    const { startIso, endIso } = getRangeForQuery(dateFilter);

    const { data: orderItems = [], isLoading } = useQuery({
        queryKey: ["service-performance", startIso, endIso],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("order_items")
                .select("service_name, price, is_internal, partner_cost")
                .gte("created_at", startIso)
                .lte("created_at", endIso);

            if (error) throw error;
            return data;
        },
    });

    const serviceStats = useMemo(() => {
        const map = new Map<
            string,
            { count: number; revenue: number; partnerCost: number; internal: number; external: number }
        >();

        orderItems.forEach((item) => {
            const name = item.service_name;
            const existing = map.get(name) || {
                count: 0,
                revenue: 0,
                partnerCost: 0,
                internal: 0,
                external: 0,
            };
            existing.count++;
            existing.revenue += item.price || 0;
            existing.partnerCost += item.partner_cost || 0;
            if (item.is_internal) {
                existing.internal++;
            } else {
                existing.external++;
            }
            map.set(name, existing);
        });

        return Array.from(map.entries())
            .map(([name, stats]) => ({
                name,
                ...stats,
                margin: stats.revenue - stats.partnerCost,
            }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [orderItems]);

    const pieData = serviceStats.slice(0, 8).map((s) => ({
        name: s.name,
        value: s.revenue,
    }));

    const totalRevenue = serviceStats.reduce((s, d) => s + d.revenue, 0);
    const totalCount = serviceStats.reduce((s, d) => s + d.count, 0);

    const CustomTooltip = ({ active, payload }: { active?: boolean, payload?: { name: string, value: number }[] }) => {
        if (!active || !payload?.length) return null;
        const data = payload[0];
        return (
            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium">{data.name}</p>
                <p className="text-primary">{formatPrice(data.value)}</p>
                <p className="text-muted-foreground">
                    {((data.value / totalRevenue) * 100).toFixed(1)}%
                </p>
            </div>
        );
    };

    if (isLoading) {
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
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Performance des Services
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {formatReportDateLabel(dateFilter)}
                    </p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div>
                        <div className="h-56">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    Aucune donnée
                                </div>
                            )}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 mt-2 justify-center">
                            {pieData.slice(0, 6).map((item, i) => (
                                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                    />
                                    <span className="text-muted-foreground truncate max-w-[100px]">
                                        {item.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div>
                        <div className="text-sm space-y-1 mb-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total services</span>
                                <span className="font-bold">{totalCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CA Total</span>
                                <span className="font-bold">{formatPrice(totalRevenue)}</span>
                            </div>
                        </div>
                        <div className="divide-y max-h-52 overflow-y-auto">
                            {serviceStats.slice(0, 10).map((service, i) => (
                                <div key={service.name} className="py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                        />
                                        <span className="text-sm truncate">{service.name}</span>
                                        <Badge variant="outline" className="text-xs flex-shrink-0">
                                            ×{service.count}
                                        </Badge>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className="text-sm font-semibold">{formatPrice(service.revenue)}</p>
                                        {service.external > 0 && (
                                            <p className="text-xs text-orange-600">
                                                {service.external} externe{service.external > 1 ? "s" : ""}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
