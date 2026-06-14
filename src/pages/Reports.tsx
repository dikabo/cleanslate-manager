import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/hooks/useServices";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Receipt,
  Landmark,
} from "lucide-react";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { ServicePerformance } from "@/components/reports/ServicePerformance";
import { ExportData } from "@/components/reports/ExportData";
import { DateFilterControls } from "@/components/reports/DateFilterControls";
import { PaymentStatusBreakdown } from "@/components/reports/PaymentStatusBreakdown";
import {
  formatReportDateLabel,
  getPresetDateFilter,
  getRangeForQuery,
  getSignedPaymentAmount,
  ReportDateFilter,
} from "@/lib/reporting";

export default function Reports() {
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>(getPresetDateFilter("thisMonth"));
  const { startIso, endIso } = getRangeForQuery(dateFilter);
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  const { data: summaryStats, error } = useQuery({
    queryKey: ["report-summary", startIso, endIso],
    queryFn: async () => {
      const [ordersRes, paymentsRes, itemsRes, expensesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total_amount, paid_amount, client_id")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase
          .from("payments")
          .select("amount, payment_type")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase
          .from("order_items")
          .select("price, partner_cost, is_internal")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase
          .from("expense_entries")
          .select("amount, category")
          .gte("expense_date", startDate)
          .lte("expense_date", endDate),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const orders = ordersRes.data || [];
      const totalCA = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const totalPaidOnPeriodOrders = orders.reduce((sum, order) => sum + (order.paid_amount || 0), 0);
      const totalCollected = (paymentsRes.data || []).reduce(
        (sum, payment) => sum + getSignedPaymentAmount(payment),
        0
      );
      const totalClients = new Set(orders.map((order) => order.client_id).filter(Boolean)).size;

      const items = itemsRes.data || [];
      const totalPartnerCost = items
        .filter((item) => !item.is_internal)
        .reduce((sum, item) => sum + (item.partner_cost || 0), 0);
      const totalItemRevenue = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const grossMargin = totalItemRevenue - totalPartnerCost;

      const expenses = expensesRes.data || [];
      const variableExpenses = expenses
        .filter((expense) => expense.category === "variable")
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
      const fixedExpenses = expenses
        .filter((expense) => expense.category === "fixed")
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
      const totalExpenses = variableExpenses + fixedExpenses;
      const netProfit = grossMargin - totalExpenses;

      return {
        ca: totalCA,
        paid: totalCollected,
        paidOnPeriodOrders: totalPaidOnPeriodOrders,
        unpaid: totalCA - totalPaidOnPeriodOrders,
        orderCount: orders.length,
        clientCount: totalClients,
        grossMargin,
        variableExpenses,
        fixedExpenses,
        totalExpenses,
        netProfit,
        avgOrderValue: orders.length > 0 ? totalCA / orders.length : 0,
      };
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Rapports & Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyse detaillee de l'activite de l'atelier
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Chargement des rapports impossible</AlertTitle>
            <AlertDescription>
              Les indicateurs de rapports n&apos;ont pas pu etre charges. Verifie la connexion internet,
              la session ou les droits d&apos;acces. Detail: {error.message}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Perimetre d'analyse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatReportDateLabel(dateFilter)}
                </p>
              </div>
              <DateFilterControls value={dateFilter} onChange={setDateFilter} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summaryStats?.ca || 0)}</p>
                  <p className="text-xs text-muted-foreground">CA sur la periode</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-emerald-100">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatPrice(summaryStats?.paid || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Encaisse sur la periode</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-amber-100">
                  <ShoppingCart className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{summaryStats?.orderCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Commandes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{summaryStats?.clientCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Clients actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-100">
                  <Receipt className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summaryStats?.variableExpenses || 0)}</p>
                  <p className="text-xs text-muted-foreground">Charges variables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-slate-200">
                  <Landmark className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summaryStats?.fixedExpenses || 0)}</p>
                  <p className="text-xs text-muted-foreground">Charges fixes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart dateFilter={dateFilter} />
          <ServicePerformance dateFilter={dateFilter} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PaymentStatusBreakdown dateFilter={dateFilter} />
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Lecture rapide</h3>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reste a encaisser</p>
                  <p className="text-lg font-bold mt-1 text-amber-600">
                    {formatPrice(summaryStats?.unpaid || 0)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Marge brute avant charges</p>
                  <p className="text-lg font-bold mt-1 text-emerald-600">
                    {formatPrice(summaryStats?.grossMargin || 0)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Resultat net estime</p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      (summaryStats?.netProfit || 0) >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {formatPrice(summaryStats?.netProfit || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ExportData dateFilter={dateFilter} />
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Resume Financier</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Panier moyen</p>
                  <p className="text-lg font-bold mt-1">
                    {formatPrice(summaryStats?.avgOrderValue || 0)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Marge brute</p>
                  <p className="text-lg font-bold mt-1 text-emerald-600">
                    {formatPrice(summaryStats?.grossMargin || 0)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Charges d'exploitation</p>
                  <p className="text-lg font-bold mt-1 text-amber-600">
                    {formatPrice(summaryStats?.totalExpenses || 0)}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Resultat net</p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      (summaryStats?.netProfit || 0) >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {formatPrice(summaryStats?.netProfit || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
