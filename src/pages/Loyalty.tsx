import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Phone,
  RefreshCw,
  Star,
  Upload,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  LegacyImportRow,
  LegacyImportSummary,
  analyzeLegacyLoyaltyWorkbook,
  normalizeName,
} from "@/lib/legacy-loyalty-import";

const supabaseLoose = supabase as any;

type LoyaltySummary = {
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  live_orders_count: number;
  live_revenue: number;
  legacy_orders_count: number;
  legacy_revenue: number;
  total_known_orders: number;
  total_known_revenue: number;
  last_activity_date: string | null;
  days_since_last_activity: number | null;
  loyalty_tier: "vip" | "regular" | "new_or_once" | "unknown";
  loyalty_segment: "dormant_high_value" | "to_reactivate" | "follow_up_overdue" | "active";
  next_follow_up_at: string | null;
  overdue_follow_ups: number;
};

type FollowUp = {
  id: string;
  client_id: string;
  due_date: string;
  reason: string;
  status: "planned" | "done" | "postponed" | "cancelled";
  contact_channel: "phone" | "whatsapp" | "email" | "in_person" | "other";
  result: string | null;
  notes: string | null;
  clients?: { name: string; phone: string | null };
};

type ExistingClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(price || 0);

const segmentLabels: Record<LoyaltySummary["loyalty_segment"], string> = {
  dormant_high_value: "Dormant forte valeur",
  to_reactivate: "A reactiver",
  follow_up_overdue: "Relance en retard",
  active: "Actif",
};

const tierLabels: Record<LoyaltySummary["loyalty_tier"], string> = {
  vip: "VIP",
  regular: "Regulier",
  new_or_once: "Occasionnel",
  unknown: "Inconnu",
};

export default function Loyalty() {
  const queryClient = useQueryClient();
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [analysis, setAnalysis] = useState<LegacyImportSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoCreateClients, setAutoCreateClients] = useState(true);
  const [importNotes, setImportNotes] = useState("");

  const {
    data: loyaltyRows = [],
    error: loyaltyError,
    isLoading: loyaltyLoading,
  } = useQuery<LoyaltySummary[]>({
    queryKey: ["client-loyalty-summary"],
    queryFn: async () => {
      const { data, error } = await supabaseLoose
        .from("client_loyalty_summary")
        .select("*")
        .order("total_known_revenue", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: followUps = [], error: followUpsError } = useQuery<FollowUp[]>({
    queryKey: ["client-follow-ups"],
    queryFn: async () => {
      const { data, error } = await supabaseLoose
        .from("client_follow_ups")
        .select("*, clients(name, phone)")
        .eq("status", "planned")
        .order("due_date", { ascending: true })
        .limit(40);

      if (error) throw error;
      return data || [];
    },
  });

  const filteredLoyaltyRows = useMemo(() => {
    if (segmentFilter === "all") return loyaltyRows;
    return loyaltyRows.filter((row) => row.loyalty_segment === segmentFilter);
  }, [loyaltyRows, segmentFilter]);

  const stats = useMemo(() => {
    const totalRevenue = loyaltyRows.reduce((sum, row) => sum + Number(row.total_known_revenue || 0), 0);
    return {
      clients: loyaltyRows.length,
      totalRevenue,
      vip: loyaltyRows.filter((row) => row.loyalty_tier === "vip").length,
      dormant: loyaltyRows.filter((row) => row.loyalty_segment === "dormant_high_value").length,
      due: followUps.filter((followUp) => followUp.due_date <= new Date().toISOString().slice(0, 10)).length,
    };
  }, [followUps, loyaltyRows]);

  const analyzeFile = async (file: File) => {
    setSelectedFile(file);
    setAnalysis(null);
    setAnalysis(await analyzeLegacyLoyaltyWorkbook(file));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!analysis) return;

      const importableRows = analysis.rows.filter((row) => row.importable);
      const { data: batch, error: batchError } = await supabaseLoose
        .from("import_batches")
        .insert({
          source_file_name: analysis.fileName,
          source_kind: "legacy_excel",
          total_rows: analysis.totals.rows,
          imported_rows: importableRows.length,
          skipped_rows: analysis.totals.skippedRows,
          notes: importNotes || null,
          metadata: {
            sheets: analysis.sheets,
            source_sheet: analysis.sourceSheetName,
            importable_amount: analysis.totals.importableAmount,
          },
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const clients = await fetchExistingClients();
      const clientIndex = buildClientIndex(clients);
      const missingRows = autoCreateClients
        ? importableRows.filter((row) => !findClientId(row, clientIndex) && row.normalized_phones.length > 0)
        : [];

      if (missingRows.length > 0) {
        const createdClients = await createMissingClients(missingRows);
        createdClients.forEach((client) => addClientToIndex(client, clientIndex));
      }

      const transactionPayload = importableRows.map((row) => ({
        client_id: findClientId(row, clientIndex),
        import_batch_id: batch.id,
        transaction_date: row.transaction_date,
        amount: row.amount,
        payment_status: row.payment_status,
        delivery_status: row.delivery_status,
        raw_name: row.raw_name,
        normalized_name: row.normalized_name,
        raw_contact: row.raw_contact,
        normalized_phones: row.normalized_phones,
        raw_observation: row.raw_observation,
        source_file_name: analysis.fileName,
        source_sheet: row.source_sheet,
        source_row: row.source_row,
        quality_flags: row.quality_flags,
        notes: row.notes,
      }));

      const { error: transactionError } = await supabaseLoose
        .from("legacy_client_transactions")
        .insert(transactionPayload);

      if (transactionError) throw transactionError;

      await upsertContactsAndAliases(importableRows, clientIndex);

      return {
        importedRows: importableRows.length,
        createdClients: missingRows.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["client-loyalty-summary"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setImportNotes("");
      alert(
        `Import termine: ${result?.importedRows ?? 0} lignes historiques, ${
          result?.createdClients ?? 0
        } clients crees.`,
      );
    },
  });

  const completeFollowUp = useMutation({
    mutationFn: async (followUpId: string) => {
      const { error } = await supabaseLoose
        .from("client_follow_ups")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          result: "Contact marque comme effectue depuis la page Fidelite",
        })
        .eq("id", followUpId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["client-loyalty-summary"] });
    },
  });

  const scheduleFollowUp = useMutation({
    mutationFn: async (client: LoyaltySummary) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const { error } = await supabaseLoose.from("client_follow_ups").insert({
        client_id: client.client_id,
        due_date: dueDate.toISOString().slice(0, 10),
        reason:
          client.loyalty_segment === "dormant_high_value"
            ? "Relance client dormant a forte valeur"
            : client.loyalty_segment === "to_reactivate"
              ? "Relance client inactif"
              : "Relance fidelite",
        contact_channel: client.email ? "email" : "phone",
        notes: `CA total connu: ${formatPrice(client.total_known_revenue)}; ${client.total_known_orders} commandes connues.`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["client-loyalty-summary"] });
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Fidelite</h1>
            <p className="text-muted-foreground mt-1">
              Historique importe, segments clients et rappels de prise de contact
            </p>
          </div>
        </div>

        {(loyaltyError || followUpsError) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tables fidelite indisponibles</AlertTitle>
            <AlertDescription>
              Execute d'abord le script SQL manuel
              <span className="font-medium"> supabase/manual_sql/loyalty/01_loyalty_history_and_followups.sql</span>
              dans Supabase, puis recharge cette page.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <MetricCard icon={Users} label="Clients suivis" value={stats.clients.toString()} />
          <MetricCard icon={Star} label="VIP" value={stats.vip.toString()} />
          <MetricCard icon={History} label="CA connu" value={formatPrice(stats.totalRevenue)} />
          <MetricCard icon={RefreshCw} label="Dormants valeur" value={stats.dormant.toString()} />
          <MetricCard icon={CalendarClock} label="Relances dues" value={stats.due.toString()} />
        </div>

        <Tabs defaultValue="clients" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full md:w-[520px]">
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="followups">Relances</TabsTrigger>
            <TabsTrigger value="import">Import Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                  <div>
                    <p className="font-medium">Segmentation fidelite</p>
                    <p className="text-sm text-muted-foreground">
                      Les chiffres combinent les commandes actuelles et l'historique importe.
                    </p>
                  </div>
                  <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les segments</SelectItem>
                      <SelectItem value="dormant_high_value">Dormants forte valeur</SelectItem>
                      <SelectItem value="to_reactivate">A reactiver</SelectItem>
                      <SelectItem value="follow_up_overdue">Relance en retard</SelectItem>
                      <SelectItem value="active">Actifs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loyaltyLoading ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Chargement des statistiques fidelite...
                  </CardContent>
                </Card>
              ) : (
                filteredLoyaltyRows.map((client) => (
                  <Card key={client.client_id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{client.name}</h3>
                            <Badge variant={client.loyalty_tier === "vip" ? "default" : "secondary"}>
                              {tierLabels[client.loyalty_tier]}
                            </Badge>
                            <Badge variant="outline">{segmentLabels[client.loyalty_segment]}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{client.phone || "Contact a completer"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatPrice(client.total_known_revenue)}</p>
                          <p className="text-xs text-muted-foreground">{client.total_known_orders} commandes</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                        <MiniStat label="Historique" value={formatPrice(client.legacy_revenue)} />
                        <MiniStat label="Actuel" value={formatPrice(client.live_revenue)} />
                        <MiniStat label="Derniere activite" value={client.last_activity_date || "-"} />
                        <MiniStat
                          label="Inactivite"
                          value={
                            client.days_since_last_activity === null
                              ? "-"
                              : `${client.days_since_last_activity} j`
                          }
                        />
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scheduleFollowUp.isPending}
                          onClick={() => scheduleFollowUp.mutate(client)}
                        >
                          <CalendarClock className="h-4 w-4 mr-2" />
                          Planifier relance
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="followups" className="space-y-4">
            {followUps.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune relance planifiee pour le moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {followUps.map((followUp) => (
                  <Card key={followUp.id}>
                    <CardContent className="pt-5">
                      <div className="flex justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{followUp.clients?.name || "Client"}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{followUp.reason}</p>
                        </div>
                        <Badge variant={followUp.due_date <= new Date().toISOString().slice(0, 10) ? "destructive" : "secondary"}>
                          {followUp.due_date}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          {followUp.contact_channel} • {followUp.clients?.phone || "contact a completer"}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completeFollowUp.isPending}
                          onClick={() => completeFollowUp.mutate(followUp.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Fait
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import historique Excel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Alert>
                  <AlertTitle>Source de verite</AlertTitle>
                  <AlertDescription>
                    L'import utilise `Feuil1` si elle existe. `Feuil2` et les regroupements servent de controle,
                    mais ne sont pas reinjectes comme commandes.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Fichier .xlsx</Label>
                    <Input
                      type="file"
                      accept=".xlsx"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) analyzeFile(file);
                      }}
                    />
                  </div>
                  <Button disabled={!selectedFile} variant="outline" onClick={() => selectedFile && analyzeFile(selectedFile)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reanalyser
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="auto-create-clients"
                    checked={autoCreateClients}
                    onCheckedChange={(checked) => setAutoCreateClients(checked === true)}
                  />
                  <Label htmlFor="auto-create-clients" className="text-sm">
                    Creer automatiquement les clients manquants quand un numero de telephone est exploitable
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Notes d'import</Label>
                  <Textarea
                    value={importNotes}
                    onChange={(event) => setImportNotes(event.target.value)}
                    placeholder="Ex: import initial Transfert Data 2025, validation partielle des lignes avec contact manquant..."
                  />
                </div>

                {analysis && <ImportPreview analysis={analysis} />}

                <Button
                  className="w-full"
                  disabled={!analysis || importMutation.isPending || analysis.totals.importableRows === 0}
                  onClick={() => importMutation.mutate()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importMutation.isPending ? "Import en cours..." : "Importer l'historique valide"}
                </Button>

                {importMutation.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Import impossible</AlertTitle>
                    <AlertDescription>{importMutation.error.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ImportPreview({ analysis }: { analysis: LegacyImportSummary }) {
  const sampleRows = analysis.rows.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniPanel label="Feuille source" value={analysis.sourceSheetName || "-"} />
        <MiniPanel label="Lignes" value={analysis.totals.rows.toString()} />
        <MiniPanel label="Importables" value={analysis.totals.importableRows.toString()} />
        <MiniPanel label="Anomalies" value={analysis.totals.anomalyRows.toString()} />
        <MiniPanel label="Montant" value={formatPrice(analysis.totals.importableAmount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-3">Feuilles detectees</h3>
            <div className="space-y-2">
              {analysis.sheets.map((sheet) => (
                <div key={sheet.name} className="flex justify-between text-sm border-b pb-2 last:border-b-0">
                  <span>{sheet.name}</span>
                  <span className="text-muted-foreground">
                    {sheet.rows} lignes • {sheet.columns} colonnes
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-3">Top clients historiques detectes</h3>
            <div className="space-y-2">
              {analysis.groupedNames.slice(0, 6).map((group) => (
                <div key={group.name} className="flex justify-between gap-3 text-sm border-b pb-2 last:border-b-0">
                  <span className="truncate">{group.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatPrice(group.amount)} • {group.rows}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-3">Echantillon des lignes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Ligne</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Montant</th>
                  <th className="py-2 pr-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{row.source_row}</td>
                    <td className="py-2 pr-3">{row.transaction_date || "-"}</td>
                    <td className="py-2 pr-3">{row.raw_name || "-"}</td>
                    <td className="py-2 pr-3">{row.normalized_phones[0] || "-"}</td>
                    <td className="py-2 pr-3">{formatPrice(row.amount)}</td>
                    <td className="py-2 pr-3">
                      {row.quality_flags.length > 0 ? row.quality_flags.join(", ") : "ok"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-1">{value}</p>
    </div>
  );
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold mt-1">{value}</p>
    </div>
  );
}

async function fetchExistingClients(): Promise<ExistingClient[]> {
  const { data, error } = await supabaseLoose.from("clients").select("id, name, phone, email");
  if (error) throw error;
  return data || [];
}

function buildClientIndex(clients: ExistingClient[]) {
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();

  clients.forEach((client) => addClientToIndex(client, { byPhone, byName }));
  return { byPhone, byName };
}

function addClientToIndex(client: ExistingClient, index: { byPhone: Map<string, string>; byName: Map<string, string> }) {
  normalizeClientPhones(client.phone).forEach((phone) => index.byPhone.set(phone, client.id));
  index.byName.set(normalizeName(client.name), client.id);
}

function findClientId(row: LegacyImportRow, index: { byPhone: Map<string, string>; byName: Map<string, string> }) {
  for (const phone of row.normalized_phones) {
    const clientId = index.byPhone.get(phone);
    if (clientId) return clientId;
  }

  return index.byName.get(row.normalized_name) ?? null;
}

async function createMissingClients(rows: LegacyImportRow[]) {
  const uniqueRows = new Map<string, LegacyImportRow>();
  rows.forEach((row) => {
    const key = row.normalized_phones[0] ?? row.normalized_name;
    if (key && !uniqueRows.has(key)) uniqueRows.set(key, row);
  });

  const payload = [...uniqueRows.values()].map((row) => ({
    name: row.raw_name,
    phone: row.normalized_phones[0],
    preferences: `Cree depuis import historique ${row.source_sheet}!${row.source_row}`,
  }));

  if (payload.length === 0) return [];

  const { data, error } = await supabaseLoose.from("clients").insert(payload).select("id, name, phone, email");
  if (error) throw error;
  return data || [];
}

async function upsertContactsAndAliases(
  rows: LegacyImportRow[],
  index: { byPhone: Map<string, string>; byName: Map<string, string> },
) {
  const contacts = new Map<string, { client_id: string; phone: string; source: string }>();
  const aliases = new Map<string, { client_id: string; alias: string; normalized_alias: string; source: string }>();

  rows.forEach((row) => {
    const clientId = findClientId(row, index);
    if (!clientId) return;

    row.normalized_phones.forEach((phone) => {
      contacts.set(`${clientId}-${phone}`, {
        client_id: clientId,
        phone,
        source: `${row.source_sheet}!${row.source_row}`,
      });
    });

    aliases.set(`${clientId}-${row.normalized_name}`, {
      client_id: clientId,
      alias: row.raw_name,
      normalized_alias: row.normalized_name,
      source: `${row.source_sheet}!${row.source_row}`,
    });
  });

  if (contacts.size > 0) {
    const { error } = await supabaseLoose
      .from("client_contacts")
      .upsert([...contacts.values()], { onConflict: "client_id,phone" });
    if (error) throw error;
  }

  if (aliases.size > 0) {
    const { error } = await supabaseLoose
      .from("client_name_aliases")
      .upsert([...aliases.values()], { onConflict: "client_id,normalized_alias" });
    if (error) throw error;
  }
}

function normalizeClientPhones(value: string | null) {
  if (!value) return [];
  return value
    .split(/[\/;,|\s]+/)
    .map((item) => item.replace(/\D/g, ""))
    .filter((item) => item.length >= 8)
    .map((item) => (item.startsWith("237") ? item : item.length === 9 && item.startsWith("6") ? `237${item}` : item));
}
