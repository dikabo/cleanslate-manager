import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { statusLabels, materialLabels } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";
import { getDefaultExportFilename, getRangeForQuery, getSignedPaymentAmount, ReportDateFilter } from "@/lib/reporting";

interface ExportDataProps {
    dateFilter: ReportDateFilter;
}

export function ExportData({ dateFilter }: ExportDataProps) {
    const [exporting, setExporting] = useState<"orders" | "items" | "clients" | "payments" | null>(null);
    const { startIso, endIso } = getRangeForQuery(dateFilter);

    const exportPayments = async () => {
        setExporting("payments");
        try {
            const { data, error } = await supabase
                .from("payments")
                .select(`
                  amount,
                  payment_type,
                  payment_method,
                  reference,
                  notes,
                  created_at,
                  orders (
                    ticket_number,
                    created_at,
                    clients (name, phone)
                  )
                `)
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const headers = [
                "Date Paiement",
                "Ticket",
                "Client",
                "Telephone",
                "Montant",
                "Montant Signe",
                "Type",
                "Methode",
                "Reference",
                "Notes",
                "Date Commande",
            ];

            const rows = (data || []).map((payment: any) => [
                format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
                payment.orders?.ticket_number || "",
                payment.orders?.clients?.name || "",
                payment.orders?.clients?.phone || "",
                payment.amount || 0,
                getSignedPaymentAmount(payment),
                payment.payment_type || "",
                payment.payment_method || "",
                payment.reference || "",
                payment.notes || "",
                payment.orders?.created_at
                    ? format(new Date(payment.orders.created_at), "dd/MM/yyyy HH:mm", { locale: fr })
                    : "",
            ]);

            downloadCSV(headers, rows, getDefaultExportFilename("paiements"));
            toast.success(`${rows.length} paiements exportes`);
        } catch (err: unknown) {
            toast.error(`Erreur export: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExporting(null);
        }
    };

    const exportOrders = async () => {
        setExporting("orders");
        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                  ticket_number,
                  status,
                  article_type,
                  custom_article_type,
                  material,
                  brand,
                  total_amount,
                  paid_amount,
                  is_paid,
                  created_at,
                  delivered_at,
                  estimated_date,
                  clients (name, phone, email)
                `)
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const headers = [
                "Ticket",
                "Client",
                "Téléphone",
                "Email Client",
                "Statut",
                "Type Article",
                "Matière",
                "Marque",
                "Total",
                "Payé",
                "Est Payé",
                "Date Création",
                "Date Livraison",
                "Date Estimée",
            ];

            interface ExportOrder {
                ticket_number: string;
                status: string;
                article_type: string;
                custom_article_type?: string | null;
                material: string;
                brand: string | null;
                total_amount: number;
                paid_amount: number;
                is_paid: boolean;
                created_at: string;
                delivered_at: string | null;
                estimated_date: string | null;
                clients: { name: string; phone: string; email: string; } | null;
            }

            const rows = (data || []).map((o: ExportOrder) => [
                o.ticket_number,
                o.clients?.name || "",
                o.clients?.phone || "",
                o.clients?.email || "",
                statusLabels[o.status as keyof typeof statusLabels] || o.status,
                getArticleTypeDisplayName(o.article_type, o.custom_article_type),
                materialLabels[o.material as keyof typeof materialLabels] || o.material,
                o.brand || "",
                o.total_amount,
                o.paid_amount,
                o.is_paid ? "Oui" : "Non",
                format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
                o.delivered_at ? format(new Date(o.delivered_at), "dd/MM/yyyy", { locale: fr }) : "",
                o.estimated_date ? format(new Date(o.estimated_date), "dd/MM/yyyy", { locale: fr }) : "",
            ]);

            downloadCSV(headers, rows, getDefaultExportFilename("commandes"));
            toast.success(`${rows.length} commandes exportées`);
        } catch (err: unknown) {
            toast.error(`Erreur export: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExporting(null);
        }
    };

    const exportItems = async () => {
        setExporting("items");
        try {
            const { data, error } = await supabase
                .from("order_items")
                .select(`
                  service_name,
                  price,
                  status,
                  is_internal,
                  partner_cost,
                  quality_rating,
                  sent_to_partner_at,
                  received_from_partner_at,
                  created_at,
                  orders (ticket_number),
                  partners (name)
                `)
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const headers = [
                "Ticket",
                "Service",
                "Prix",
                "Statut",
                "Interne",
                "Partenaire",
                "Coût Partenaire",
                "Marge",
                "Qualité",
                "Date Envoi Partenaire",
                "Date Réception Partenaire",
                "Date Création",
            ];

            interface ExportItem {
                service_name: string;
                price: number;
                status: string;
                is_internal: boolean;
                partner_cost: number | null;
                quality_rating: number | null;
                sent_to_partner_at: string | null;
                received_from_partner_at: string | null;
                created_at: string;
                orders: { ticket_number: string } | null;
                partners: { name: string } | null;
            }

            const rows = (data || []).map((item: ExportItem) => [
                item.orders?.ticket_number || "",
                item.service_name,
                item.price,
                item.status,
                item.is_internal ? "Oui" : "Non",
                item.partners?.name || "",
                item.partner_cost || 0,
                item.price - (item.partner_cost || 0),
                item.quality_rating || "",
                item.sent_to_partner_at
                    ? format(new Date(item.sent_to_partner_at), "dd/MM/yyyy", { locale: fr })
                    : "",
                item.received_from_partner_at
                    ? format(new Date(item.received_from_partner_at), "dd/MM/yyyy", { locale: fr })
                    : "",
                format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
            ]);

            downloadCSV(headers, rows, getDefaultExportFilename("services"));
            toast.success(`${rows.length} services exportés`);
        } catch (err: unknown) {
            toast.error(`Erreur export: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExporting(null);
        }
    };

    const exportClients = async () => {
        setExporting("clients");
        try {
            const { data, error } = await supabase
                .from("clients")
                .select(`
                  id,
                  name,
                  phone,
                  email,
                  loyalty_points,
                  created_at,
                  orders (
                    id,
                    total_amount,
                    created_at
                  )
                `)
                .gte("created_at", startIso)
                .lte("created_at", endIso)
                .order("name");

            if (error) throw error;

            const headers = [
                "Nom",
                "Téléphone",
                "Email",
                "Points Fidélité",
                "Date Inscription",
                "Nombre Commandes",
                "CA Total",
                "Dernière Commande"
            ];

            const rows = (data || []).map((client: any) => {
                const orders = client.orders || [];
                const caTotal = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
                const nbrOrders = orders.length;

                let lastOrderDate = "";
                if (nbrOrders > 0) {
                    const sortedOrders = [...orders].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    lastOrderDate = format(new Date(sortedOrders[0].created_at), "dd/MM/yyyy HH:mm", { locale: fr });
                }

                return [
                    client.name,
                    client.phone,
                    client.email || "",
                    client.loyalty_points || 0,
                    format(new Date(client.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
                    nbrOrders,
                    caTotal,
                    lastOrderDate
                ];
            });

            downloadCSV(headers, rows, getDefaultExportFilename("clients"));
            toast.success(`${rows.length} clients exportés`);
        } catch (err: unknown) {
            toast.error(`Erreur export: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExporting(null);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Export Données
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Téléchargez vos données au format CSV pour analyse comptable ou
                    importation dans Excel.
                </p>
                <div className="space-y-3">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={exportPayments}
                        disabled={exporting !== null}
                    >
                        {exporting === "payments" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <div className="text-left">
                            <p className="font-medium">Export Paiements</p>
                            <p className="text-xs text-muted-foreground">
                                Encaissements reels par date, methode et ticket
                            </p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={exportOrders}
                        disabled={exporting !== null}
                    >
                        {exporting === "orders" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <div className="text-left">
                            <p className="font-medium">Export Commandes</p>
                            <p className="text-xs text-muted-foreground">
                                Ticket, client, statut, montants, dates
                            </p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={exportItems}
                        disabled={exporting !== null}
                    >
                        {exporting === "items" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <div className="text-left">
                            <p className="font-medium">Export Services / Prestations</p>
                            <p className="text-xs text-muted-foreground">
                                Service, prix, partenaire, marge, qualité
                            </p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={exportClients}
                        disabled={exporting !== null}
                    >
                        {exporting === "clients" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        <div className="text-left">
                            <p className="font-medium">Export Clients</p>
                            <p className="text-xs text-muted-foreground">
                                Historique global, CA total, commandes par client
                            </p>
                        </div>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function downloadCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][], filename: string) {
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const csvContent =
        BOM +
        headers.join(";") +
        "\n" +
        rows.map((row) => row.map(escapeCSV).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCSV(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
