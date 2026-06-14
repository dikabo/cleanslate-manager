import { useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Order, OrderArticle, ArticleType, Material, statusLabels, statusColors, articleTypeLabels, materialLabels, itemStatusLabels, paymentTypeLabels, paymentMethodLabels } from "@/types";
import { getArticleTypeDisplayName, useArticleCategories } from "@/hooks/useArticleCategories";
import { formatPrice } from "@/hooks/useServices";
import { cn } from "@/lib/utils";
import { useAdvanceOrderStatus, getNextStatus } from "@/hooks/useOrderStatus";
import { usePayments } from "@/hooks/usePayments";
import { useUpdateArticle, useDeleteArticle, useUpdateItem, useDeleteItem, useDeleteOrder, useApplyOrderDiscount } from "@/hooks/useOrderMutations";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialog } from "./PaymentDialog";
import { PhotoUpload } from "./PhotoUpload";
import { AddArticleDialog } from "./AddArticleDialog";
import { AddServiceDialog } from "./AddServiceDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Calendar,
  ArrowRight,
  Camera,
  CheckCircle,
  XCircle,
  Building,
  Star,
  Package,
  Settings,
  Printer,
  PenLine,
  Plus,
  Wrench,
  Banknote,
  Clock,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ZoomIn,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PartnerAssignmentDialog } from "./PartnerAssignmentDialog";
import { OrderSendToPartnerDialog } from "./OrderSendToPartnerDialog";
import { OrderReceiveFromPartnerDialog } from "./OrderReceiveFromPartnerDialog";
import { OrderItem } from "@/types";
import logoUrl from "@/assets/logo-cleanup.jpg";

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

const orderDetailSelect = `
  *,
  clients (*),
  order_articles (*),
  order_items (
    *,
    partners (*),
    order_item_partners (
      *,
      partners (*)
    )
  ),
  photos (*)
`;

export function OrderDetailSheet({ order: initialOrder, open, onClose }: OrderDetailSheetProps) {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [addServiceArticleId, setAddServiceArticleId] = useState("");
  const [addServiceArticleLabel, setAddServiceArticleLabel] = useState("");
  const [sendToPartnerDialogOpen, setSendToPartnerDialogOpen] = useState(false);
  const [receiveFromPartnerDialogOpen, setReceiveFromPartnerDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [discountAmountInput, setDiscountAmountInput] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [pickupSelection, setPickupSelection] = useState<Record<string, boolean>>({});
  const [pickupSuggestedAmount, setPickupSuggestedAmount] = useState<number | undefined>(undefined);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string; filename: string } | null>(null);
  const orderId = initialOrder?.id ?? "";
  const advanceStatus = useAdvanceOrderStatus();
  const { data: payments = [] } = usePayments(initialOrder?.id);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: detailedOrder } = useQuery({
    queryKey: ["order-detail", orderId],
    enabled: open && !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(orderDetailSelect)
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as Order;
    },
  });

  // Inline editing state
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleData, setEditArticleData] = useState<{
    article_type: ArticleType;
    custom_article_type: string;
    material: Material;
    brand: string;
    color: string;
  }>({ article_type: "sneakers", custom_article_type: "", material: "leather", brand: "", color: "" });
  const [editShowCustomInput, setEditShowCustomInput] = useState(false);
  const [editingItemPrices, setEditingItemPrices] = useState<Record<string, number>>({});

  // Custom categories
  const { data: customCategories = [] } = useArticleCategories();

  // Mutations
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const applyOrderDiscount = useApplyOrderDiscount();
  const deleteOrder = useDeleteOrder();

  const partialPickupMutation = useMutation({
    mutationFn: async (
      selections: Array<{ articleId: string; articleAmount: number }>
    ) => {
      if (!orderId) throw new Error("Commande introuvable");
      if (selections.length === 0) throw new Error("Aucun article selectionne");

      const now = new Date().toISOString();
      const pickupGroupId = crypto.randomUUID();
      const selectedAmount = selections.reduce((sum, item) => sum + item.articleAmount, 0);

      const { data: authData } = await supabase.auth.getUser();
      const pickedUpBy = authData?.user?.id || null;

      const articleIds = selections.map((s) => s.articleId);

      const { error: articleUpdateError } = await supabase
        .from("order_articles")
        .update({
          picked_up_at: now,
          picked_up_by: pickedUpBy,
          pickup_group_id: pickupGroupId,
        })
        .in("id", articleIds);

      if (articleUpdateError) throw articleUpdateError;

      const pickupRows = selections.map((entry) => ({
        order_id: orderId,
        article_id: entry.articleId,
        pickup_group_id: pickupGroupId,
        picked_up_at: now,
        picked_up_by: pickedUpBy,
        article_amount: entry.articleAmount,
        payment_amount: 0,
      }));

      const { error: pickupError } = await supabase
        .from("order_article_pickups")
        .insert(pickupRows);

      if (pickupError) throw pickupError;

      const { data: remainingArticles, error: remainingError } = await supabase
        .from("order_articles")
        .select("id")
        .eq("order_id", orderId)
        .is("picked_up_at", null);

      if (remainingError) throw remainingError;

      if (!remainingArticles || remainingArticles.length === 0) {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({
            status: "delivered",
            delivered_at: now,
          })
          .eq("id", orderId);

        if (orderUpdateError) throw orderUpdateError;
      }

      return { selectedAmount, selectedCount: selections.length };
    },
    onSuccess: ({ selectedAmount, selectedCount }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-article-pickups", orderId] });
      setPickupSelection({});
      toast.success(
        `Retrait enregistre pour ${selectedCount} article(s) (${formatPrice(selectedAmount)})`
      );
    },
    onError: (error: Error) => {
      toast.error(`Erreur retrait: ${error.message}`);
    },
  });

  const { data: pickupRows = [] } = useQuery({
    queryKey: ["order-article-pickups", orderId],
    enabled: open && !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_article_pickups")
        .select(`
          *,
          order_articles (*)
        `)
        .eq("order_id", orderId)
        .order("picked_up_at", { ascending: false });

      if (error) {
        if (error.message?.includes("order_article_pickups")) return [];
        throw error;
      }
      return (data || []) as Array<{
        id: string;
        article_id: string;
        pickup_group_id: string;
        picked_up_at: string;
        article_amount: number;
        payment_amount: number;
        order_articles?: OrderArticle | OrderArticle[] | null;
      }>;
    },
  });

  const order = detailedOrder || initialOrder;

  if (!order) return null;

  const subtotalAmount = order.subtotal_amount ?? order.total_amount;
  const discountAmount = order.discount_amount || 0;
  const balanceAmount = Math.max(0, order.total_amount - order.paid_amount);
  const overpaidAmount = Math.max(0, order.paid_amount - order.total_amount);

  const isReceived = order.status === "received";

  const beforePhotos = order.photos?.filter(p => p.type === 'before') || [];
  const afterPhotos = order.photos?.filter(p => p.type === 'after') || [];

  const articles = order.order_articles || [];
  const itemsByArticle = new Map<string, OrderItem[]>();

  order.order_items?.forEach(item => {
    const articleId = (item as { article_id?: string }).article_id || "default";
    const items = itemsByArticle.get(articleId) || [];
    items.push(item);
    itemsByArticle.set(articleId, items);
  });

  const statusSteps: Array<{ key: typeof order.status; label: string }> = [
    { key: "received", label: "Réception" },
    { key: "validated", label: "Validée" },
    { key: "sent_to_partner", label: "Production" },
    { key: "received_from_partner", label: "Retour" },
    { key: "ready", label: "Prêt" },
    { key: "delivered", label: "Livré" },
  ];

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status);
  const nextStatus = getNextStatus(order.status);

  const terminalItemStatuses = new Set(["completed", "received_from_partner"]);

  const articleDeliveryDetails = articles.map((article) => {
    const articleItems = itemsByArticle.get(article.id) || [];
    const articleTotal = articleItems.reduce((sum, item) => sum + item.price, 0);
    const isReady =
      articleItems.length > 0 &&
      articleItems.every((item) => terminalItemStatuses.has(item.status));
    const isPickedUp = Boolean(article.picked_up_at);

    return {
      article,
      articleItems,
      articleTotal,
      isReady,
      isPickedUp,
      canPickup: isReady && !isPickedUp,
    };
  });

  const selectedPickupArticleIds = articleDeliveryDetails
    .filter((entry) => pickupSelection[entry.article.id] && entry.canPickup)
    .map((entry) => entry.article.id);

  const selectedPickupAmount = articleDeliveryDetails
    .filter((entry) => selectedPickupArticleIds.includes(entry.article.id))
    .reduce((sum, entry) => sum + entry.articleTotal, 0);

  const alreadyPickedAmount = articleDeliveryDetails
    .filter((entry) => entry.isPickedUp)
    .reduce((sum, entry) => sum + entry.articleTotal, 0);

  const requiredPaidAfterSelection = alreadyPickedAmount + selectedPickupAmount;
  const pickupPaymentGap = Math.max(0, requiredPaidAfterSelection - order.paid_amount);

  const groupedPickups = new Map<
    string,
    {
      pickedUpAt: string;
      paymentAmount: number;
      articleAmount: number;
      labels: string[];
    }
  >();

  pickupRows.forEach((pickup) => {
    const key = pickup.pickup_group_id || pickup.id;
    const article = Array.isArray(pickup.order_articles)
      ? pickup.order_articles[0]
      : pickup.order_articles;
    const labelBase = article
      ? `${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` - ${article.brand}` : ""}`
      : pickup.article_id;
    const entry = groupedPickups.get(key);

    if (!entry) {
      groupedPickups.set(key, {
        pickedUpAt: pickup.picked_up_at,
        paymentAmount: pickup.payment_amount || 0,
        articleAmount: pickup.article_amount || 0,
        labels: [labelBase],
      });
    } else {
      entry.labels.push(labelBase);
      entry.articleAmount += pickup.article_amount || 0;
      entry.paymentAmount += pickup.payment_amount || 0;
    }
  });

  const pickupHistory = Array.from(groupedPickups.entries())
    .map(([groupId, value]) => ({ groupId, ...value }))
    .sort((a, b) => new Date(b.pickedUpAt).getTime() - new Date(a.pickedUpAt).getTime());

  const openAssignmentDialog = (item: OrderItem) => {
    setSelectedItem(item);
    setAssignmentDialogOpen(true);
  };

  const openAddServiceDialog = (articleId: string, articleLabel: string) => {
    setAddServiceArticleId(articleId);
    setAddServiceArticleLabel(articleLabel);
    setAddServiceDialogOpen(true);
  };

  const startEditingArticle = (article: OrderArticle) => {
    setEditingArticleId(article.id);
    setEditArticleData({
      article_type: article.article_type as ArticleType,
      custom_article_type: article.custom_article_type || "",
      material: article.material as Material,
      brand: article.brand || "",
      color: article.color || "",
    });
    setEditShowCustomInput(false);
  };

  const saveArticleEdit = (articleId: string) => {
    updateArticle.mutate(
      {
        articleId,
        data: {
          article_type: editArticleData.article_type,
          custom_article_type: editArticleData.article_type === "other" ? editArticleData.custom_article_type || null : null,
          material: editArticleData.material,
          brand: editArticleData.brand || null,
          color: editArticleData.color || null,
        },
      },
      { onSuccess: () => setEditingArticleId(null) }
    );
  };

  const startEditingItemPrice = (item: OrderItem) => {
    setEditingItemPrices((prev) => ({ ...prev, [item.id]: item.price }));
  };

  const saveItemPrice = (itemId: string) => {
    const newPrice = editingItemPrices[itemId];
    if (newPrice !== undefined) {
      updateItem.mutate(
        { itemId, orderId: order.id, data: { price: newPrice } },
        {
          onSuccess: () =>
            setEditingItemPrices((prev) => {
              const next = { ...prev };
              delete next[itemId];
              return next;
            }),
        }
      );
    }
  };

  const togglePickupSelection = (articleId: string, checked: boolean) => {
    setPickupSelection((prev) => ({ ...prev, [articleId]: checked }));
  };

  const handleConfirmPartialPickup = () => {
    if (selectedPickupArticleIds.length === 0) {
      toast.error("Selectionnez au moins un article pret a remettre");
      return;
    }

    if (pickupPaymentGap > 0) {
      setPickupSuggestedAmount(pickupPaymentGap);
      setPaymentDialogOpen(true);
      toast.warning(
        `Solde insuffisant pour ces articles. Encaissez ${formatPrice(pickupPaymentGap)} avant de valider le retrait.`
      );
      return;
    }

    const selections = articleDeliveryDetails
      .filter((entry) => selectedPickupArticleIds.includes(entry.article.id))
      .map((entry) => ({ articleId: entry.article.id, articleAmount: entry.articleTotal }));

    partialPickupMutation.mutate(selections);
  };

  const handleAdvanceStatus = () => {
    advanceStatus.mutate(
      {
        orderId: order.id,
        currentStatus: order.status,
        paidAmount: order.paid_amount,
        totalAmount: order.total_amount,
      },
      {
        onSuccess: (nextStatus) => {
          if (nextStatus === "sent_to_partner") {
            setSendToPartnerDialogOpen(true);
          } else if (nextStatus === "received_from_partner") {
            setReceiveFromPartnerDialogOpen(true);
          }
        }
      }
    );
  };

  const handleApplyDiscount = () => {
    const parsedAmount = Number(discountAmountInput);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error("Saisissez un montant de remise valide.");
      return;
    }

    applyOrderDiscount.mutate(
      {
        orderId: order.id,
        discountAmount: parsedAmount,
        discountReason,
      },
      {
        onSuccess: () => {
          setDiscountDialogOpen(false);
        },
      }
    );
  };

  const handleDownloadPhoto = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading photo:', error);
      window.open(url, '_blank'); // Fallback
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const articleRows = articles.map((article) => {
      const articleItems = itemsByArticle.get(article.id) || [];
      const servicesHtml = articleItems
        .map(
          (item) =>
            `<tr><td style="padding:4px 8px">${item.service_name}</td><td style="padding:4px 8px;text-align:right">${formatPrice(item.price)}</td></tr>`
        )
        .join("");
      return `
        <tr style="background:#f3f4f6">
          <td colspan="2" style="padding:6px 8px;font-weight:600">
            ${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}
            ${article.brand ? ` — ${article.brand}` : ""}
            (${materialLabels[article.material as keyof typeof materialLabels] || article.material})
          </td>
        </tr>
        ${servicesHtml}
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket ${order.ticket_number}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
          .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 16px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          table td { border-bottom: 1px solid #eee; }
          .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 8px; padding-top: 8px; border-top: 2px solid #333; }
          .signature { margin-top: 24px; text-align: center; }
          .signature img { max-height: 80px; }
          .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
          @media print { body { margin: 0; padding: 10px; } }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${window.location.origin}${logoUrl}" alt="Clean Up Logo" style="height: 50px; margin-bottom: 8px;" />
          <h1 style="margin: 0; font-size: 18px;">CLEAN UP SARL</h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666; line-height: 1.4;">
            49 RUE Koufrah DOUALA<br/>
            Tél: 693 896 155 / 671 420 308<br/>
            Email: cleanupatelier2022@gmail.com<br/>
            NIU: M032416634417L | RCCM: CM-DLA-03-2024-B12-00178
          </p>
        </div>
        <p class="subtitle" style="margin-top: 10px; margin-bottom: 12px;">Ticket de Commande</p>
        <hr/>
        <div class="info"><span>N° Ticket:</span><strong>${order.ticket_number}</strong></div>
        <div class="info"><span>Client:</span><strong>${order.clients?.name || "—"}</strong></div>
        <div class="info"><span>Téléphone:</span><span>${order.clients?.phone || "—"}</span></div>
        <div class="info"><span>Date:</span><span>${format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>
        <div class="info"><span>Statut:</span><span>${statusLabels[order.status]}</span></div>
        ${order.estimated_date ? `<div class="info"><span>Date estimée:</span><span>${format(new Date(order.estimated_date), "dd/MM/yyyy", { locale: fr })}</span></div>` : ""}
        <table>${articleRows}</table>
        ${discountAmount > 0 ? `<div class="info"><span>Sous-total:</span><strong>${formatPrice(subtotalAmount)}</strong></div><div class="info"><span>Remise:</span><strong>- ${formatPrice(discountAmount)}</strong></div>` : ""}
        <div class="total">Total: ${formatPrice(order.total_amount)}</div>
        <div class="info" style="margin-top:8px"><span>Paiement:</span><strong>${order.is_paid ? "✅ Payé" : (order.paid_amount > 0 ? "⚠️ Partiel" : "❌ Non payé")}</strong></div>
        ${order.paid_amount > 0 ? `<div class="info"><span>Encaisse:</span><strong>${formatPrice(order.paid_amount)}</strong></div>` : ""}
        ${balanceAmount > 0 ? `<div class="info"><span>Reste à payer:</span><strong>${formatPrice(balanceAmount)}</strong></div>` : ""}
        ${overpaidAmount > 0 ? `<div class="info"><span>Trop-percu:</span><strong>${formatPrice(overpaidAmount)}</strong></div>` : ""}
        ${order.signature_url ? `<div class="signature"><p style="font-size:12px;color:#666">Signature client :</p><img src="${order.signature_url}" alt="Signature"/></div>` : ""}
        <div style="margin-top: 20px; font-size: 11px; color: #555; text-align: center; border-top: 1px dashed #ccc; padding-top: 10px;">
          <strong>Attention:</strong> Notre espace est limité. Veuillez passer récupérer vos articles aussitôt disponibles. Passé un délai de 10 jours, nous considérons le stockage comme un nouveau service facturable.
        </div>
        <div class="footer">
          <p>Merci de votre confiance !</p>
          <p>CLEAN UP SARL</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display text-xl">
                {order.ticket_number}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handlePrint} title="Imprimer">
                  <Printer className="h-4 w-4" />
                </Button>
                <Badge className={cn("font-medium", statusColors[order.status])}>
                  {statusLabels[order.status]}
                </Badge>
              </div>
            </div>
          </SheetHeader>

          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, index) => (
                <div key={step.key} className="flex items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      index <= currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div
                      className={cn(
                        "w-8 h-0.5 mx-1",
                        index < currentStepIndex ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              {statusSteps.map((step) => (
                <span key={step.key} className="text-[10px] text-muted-foreground">
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Client Info */}
          <Collapsible defaultOpen={false} className="mb-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Client
                <span className="text-xs font-normal text-muted-foreground">
                  — {order.clients?.name || 'Client inconnu'}
                </span>
              </h4>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <div className="bg-muted/50 rounded-lg p-4 mt-1">
                <p className="font-medium text-foreground">{order.clients?.name || 'Client inconnu'}</p>
                {order.clients?.phone && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{order.clients.phone}</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Articles & Services */}
          <Collapsible defaultOpen={true} className="mb-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Articles ({articles.length || 1})
              </h4>
              <div className="flex items-center gap-2">
                <div onClick={(e) => e.stopPropagation()}>
                  <AddArticleDialog
                    orderId={order.id}
                    currentArticleCount={articles.length}
                  />
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="space-y-4">
              {articles.length > 0 ? (
                articles.map((article) => {
                  const articleItems = itemsByArticle.get(article.id) || [];
                  const articleLabel = `${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` — ${article.brand}` : ""}`;
                  return (
                    <div key={article.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 p-3">
                        {editingArticleId === article.id ? (
                          /* ── Inline article editing ── */
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={editShowCustomInput ? "__new__" : (editArticleData.article_type === "other" && editArticleData.custom_article_type ? `custom:${editArticleData.custom_article_type}` : editArticleData.article_type)}
                                onValueChange={(v) => {
                                  if (v === "__new__") {
                                    setEditArticleData((d) => ({ ...d, article_type: "other" as ArticleType, custom_article_type: "" }));
                                    setEditShowCustomInput(true);
                                  } else if (v.startsWith("custom:")) {
                                    setEditArticleData((d) => ({ ...d, article_type: "other" as ArticleType, custom_article_type: v.replace("custom:", "") }));
                                    setEditShowCustomInput(false);
                                  } else {
                                    setEditArticleData((d) => ({ ...d, article_type: v as ArticleType, custom_article_type: "" }));
                                    setEditShowCustomInput(false);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(articleTypeLabels)
                                    .filter(([k]) => k !== "other")
                                    .map(([k, l]) => (
                                    <SelectItem key={k} value={k}>{l}</SelectItem>
                                  ))}
                                  {customCategories.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Catégories personnalisées</div>
                                      {customCategories.map((cat) => (
                                        <SelectItem key={cat.id} value={`custom:${cat.name}`}>{cat.name}</SelectItem>
                                      ))}
                                    </>
                                  )}
                                  <div className="px-2 py-1.5 border-t" />
                                  <SelectItem value="__new__">
                                    <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Autre</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {editShowCustomInput && (
                                <Input
                                  value={editArticleData.custom_article_type}
                                  onChange={(e) => setEditArticleData((d) => ({ ...d, custom_article_type: e.target.value }))}
                                  placeholder="Nom de la catégorie..."
                                  className="h-8 text-xs mt-1"
                                  autoFocus
                                />
                              )}
                              <Select
                                value={editArticleData.material}
                                onValueChange={(v) =>
                                  setEditArticleData((d) => ({ ...d, material: v as Material }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(materialLabels).map(([k, l]) => (
                                    <SelectItem key={k} value={k}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={editArticleData.brand}
                                onChange={(e) =>
                                  setEditArticleData((d) => ({ ...d, brand: e.target.value }))
                                }
                                placeholder="Marque"
                                className="h-8 text-xs"
                              />
                              <Input
                                value={editArticleData.color}
                                onChange={(e) =>
                                  setEditArticleData((d) => ({ ...d, color: e.target.value }))
                                }
                                placeholder="Couleur"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setEditingArticleId(null)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Annuler
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => saveArticleEdit(article.id)}
                                disabled={updateArticle.isPending}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Enregistrer
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Normal article header ── */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge>{getArticleTypeDisplayName(article.article_type, article.custom_article_type)}</Badge>
                              <Badge variant="outline">{materialLabels[article.material as keyof typeof materialLabels]}</Badge>
                              {article.brand && <span className="text-sm">{article.brand}</span>}
                              {(() => {
                                const state = articleDeliveryDetails.find((entry) => entry.article.id === article.id);
                                if (!state) return null;
                                if (state.isPickedUp) {
                                  return (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                      Retire
                                    </Badge>
                                  );
                                }
                                if (state.isReady) {
                                  return (
                                    <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                                      Pret a remettre
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                                    En traitement
                                  </Badge>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const state = articleDeliveryDetails.find((entry) => entry.article.id === article.id);
                                if (!state?.canPickup) return null;
                                return (
                                  <div className="flex items-center gap-2 px-2">
                                    <Checkbox
                                      checked={Boolean(pickupSelection[article.id])}
                                      onCheckedChange={(checked) =>
                                        togglePickupSelection(article.id, checked === true)
                                      }
                                    />
                                    <span className="text-[10px] text-muted-foreground">Retrait</span>
                                  </div>
                                );
                              })()}
                              {isReceived && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => startEditingArticle(article)}
                                    title="Modifier l'article"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        title="Supprimer l'article"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          L'article et tous ses services associés seront définitivement supprimés.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() =>
                                            deleteArticle.mutate({ articleId: article.id, orderId: order.id })
                                          }
                                        >
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() =>
                                  openAddServiceDialog(article.id, articleLabel)
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Service
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      {article.description && editingArticleId !== article.id && (
                        <p className="text-sm text-muted-foreground px-3 py-1.5">{article.description}</p>
                      )}
                      <div className="divide-y">
                        {articleItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{item.service_name}</p>
                                {!item.is_internal && item.order_item_partners && item.order_item_partners.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 ml-2">
                                    {item.order_item_partners.map((p, idx) => (
                                      <Badge key={idx} className="bg-orange-100 text-orange-800 text-[10px] font-normal leading-tight h-auto py-0.5">
                                        <Building className="h-3 w-3 mr-1" />
                                        {p.partners?.name || 'Externe'} : {p.task_description}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : !item.is_internal && (
                                  <Badge className="bg-orange-100 text-orange-800 text-[10px] ml-2 font-normal leading-tight h-auto py-0.5">
                                    <Building className="h-3 w-3 mr-1" />
                                    {item.partners?.name || 'Externe'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {itemStatusLabels[item.status]}
                                </Badge>
                                {item.quality_rating && (
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: item.quality_rating }, (_, i) => (
                                      <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Price: inline editable when received */}
                              {isReceived && editingItemPrices[item.id] !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={editingItemPrices[item.id]}
                                    onChange={(e) =>
                                      setEditingItemPrices((prev) => ({
                                        ...prev,
                                        [item.id]: parseInt(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-20 h-7 text-xs"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => saveItemPrice(item.id)}
                                    disabled={updateItem.isPending}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setEditingItemPrices((prev) => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                      })
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className={cn(
                                    "text-sm font-semibold",
                                    isReceived && "cursor-pointer hover:text-primary"
                                  )}
                                  onClick={() => isReceived && startEditingItemPrice(item)}
                                  title={isReceived ? "Cliquez pour modifier le prix" : undefined}
                                >
                                  {formatPrice(item.price)}
                                </span>
                              )}
                              {/* Delete service button */}
                              {isReceived && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      title="Supprimer ce service"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer ce service ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Le service "{item.service_name}" ({formatPrice(item.price)}) sera supprimé et le total recalculé.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() =>
                                          deleteItem.mutate({ itemId: item.id, orderId: order.id })
                                        }
                                      >
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openAssignmentDialog(item)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {articleItems.length === 0 && (
                          <div className="p-3 text-center text-xs text-muted-foreground italic">
                            Aucun service — cliquez "+ Service" pour en ajouter
                          </div>
                        )}
                      </div>

                      {/* --- PHOTOS PAR ARTICLE --- */}
                      <div className="p-3 bg-muted/20 border-t">
                        <h5 className="font-semibold text-xs mb-2 text-muted-foreground flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Photos de l'article
                        </h5>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Avant */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Avant</p>
                            {(() => {
                              const articleBefore = beforePhotos.filter(p => p.article_id === article.id);
                              return (
                                <div className="space-y-1">
                                  {articleBefore.length > 0 && (
                                    <div className="grid grid-cols-3 gap-1">
                                      {articleBefore.map((p, idx) => (
                                        <div
                                          key={p.id}
                                          className="relative group aspect-square cursor-pointer"
                                          onClick={() => setPreviewPhoto({
                                            url: p.url,
                                            label: `Avant — ${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` (${article.brand})` : ''}`,
                                            filename: `photo-avant-${order.ticket_number}-${article.id}-${idx + 1}.jpg`,
                                          })}
                                        >
                                          <img src={p.url} alt="Avant" className="w-full h-full object-cover rounded shadow-sm" />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                            <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <PhotoUpload
                                    orderId={order.id}
                                    type="before"
                                    articleId={article.id}
                                    existingPhotos={articleBefore}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                          {/* Après */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Après</p>
                            {(() => {
                              const articleAfter = afterPhotos.filter(p => p.article_id === article.id);
                              return (
                                <div className="space-y-1">
                                  {articleAfter.length > 0 && (
                                    <div className="grid grid-cols-3 gap-1">
                                      {articleAfter.map((p, idx) => (
                                        <div
                                          key={p.id}
                                          className="relative group aspect-square cursor-pointer"
                                          onClick={() => setPreviewPhoto({
                                            url: p.url,
                                            label: `Après — ${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` (${article.brand})` : ''}`,
                                            filename: `photo-apres-${order.ticket_number}-${article.id}-${idx + 1}.jpg`,
                                          })}
                                        >
                                          <img src={p.url} alt="Après" className="w-full h-full object-cover rounded shadow-sm" />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                            <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <PhotoUpload
                                    orderId={order.id}
                                    type="after"
                                    articleId={article.id}
                                    existingPhotos={articleAfter}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      {/* --- FIN PHOTOS PAR ARTICLE --- */}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Type</p>
                      <p className="font-medium">{getArticleTypeDisplayName(order.article_type, order.custom_article_type)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Matière</p>
                      <p className="font-medium">{materialLabels[order.material]}</p>
                    </div>
                  </div>
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.service_name}</p>
                          {!item.is_internal && item.order_item_partners && item.order_item_partners.length > 0 ? (
                            <div className="flex flex-wrap gap-1 ml-2">
                              {item.order_item_partners.map((p, idx) => (
                                <Badge key={idx} className="bg-orange-100 text-orange-800 text-[10px] font-normal leading-tight h-auto py-0.5">
                                  <Building className="h-3 w-3 mr-1" />
                                  {p.partners?.name || 'Externe'} : {p.task_description}
                                </Badge>
                              ))}
                            </div>
                          ) : !item.is_internal && (
                            <Badge className="bg-orange-100 text-orange-800 text-[10px] ml-2 font-normal leading-tight h-auto py-0.5">
                              <Building className="h-3 w-3 mr-1" />
                              {item.partners?.name || 'Externe'}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs mt-1">{itemStatusLabels[item.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{formatPrice(item.price)}</span>
                        <Button variant="ghost" size="sm" onClick={() => openAssignmentDialog(item)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Partial pickup section */}
          {articles.length > 0 && (
            <Collapsible defaultOpen={false} className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Retraits partiels
                  {pickupHistory.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">— {pickupHistory.length} retrait(s)</span>
                  )}
                </h4>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 space-y-3 mt-1">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Articles selectionnes</span>
                  <span className="font-medium">
                    {selectedPickupArticleIds.length} ({formatPrice(selectedPickupAmount)})
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Montant requis apres retrait</span>
                  <span className="font-medium">{formatPrice(requiredPaidAfterSelection)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ecart de paiement</span>
                  <span className={cn("font-semibold", pickupPaymentGap > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {pickupPaymentGap > 0 ? formatPrice(pickupPaymentGap) : "Solde OK"}
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  {pickupPaymentGap > 0 && (
                    <Button
                      variant="outline"
                      className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        setPickupSuggestedAmount(pickupPaymentGap);
                        setPaymentDialogOpen(true);
                      }}
                    >
                      Encaisser {formatPrice(pickupPaymentGap)}
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    onClick={handleConfirmPartialPickup}
                    disabled={selectedPickupArticleIds.length === 0 || partialPickupMutation.isPending}
                  >
                    {partialPickupMutation.isPending ? "Validation..." : "Valider le retrait partiel"}
                  </Button>
                </div>
              </div>

              {pickupHistory.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Historique des retraits</p>
                  <div className="space-y-2">
                    {pickupHistory.map((entry) => (
                      <div key={entry.groupId} className="rounded-md bg-muted/40 p-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{format(new Date(entry.pickedUpAt), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
                          <span className="font-medium">{formatPrice(entry.articleAmount)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entry.labels.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Diagnosis */}
          {order.diagnosis && (
            <Collapsible defaultOpen={false} className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Diagnostic
                </h4>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 mt-1">
                  {order.diagnosis}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator className="mb-4" />

          {/* Payment section */}
          <Collapsible defaultOpen={true} className="mb-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Paiement
                <span className="text-xs font-normal text-muted-foreground">
                  — {formatPrice(order.paid_amount)} / {formatPrice(order.total_amount)}
                </span>
              </h4>
              <div className="flex items-center gap-2">
                {order.is_paid ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0 px-1.5">Payé</Badge>
                ) : order.paid_amount > 0 ? (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px] py-0 px-1.5">Avance</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 text-[10px] py-0 px-1.5">Non payé</Badge>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 mt-1">
            {discountAmount > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sous-total initial</span>
                  <span className="font-medium">{formatPrice(subtotalAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Remise accordee</span>
                  <span className="font-semibold text-amber-700">- {formatPrice(discountAmount)}</span>
                </div>
                {order.discount_reason && (
                  <p className="mt-2 text-xs text-amber-800">
                    Motif: {order.discount_reason}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">{formatPrice(order.total_amount)}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  order.is_paid
                    ? "bg-emerald-500"
                    : order.paid_amount > 0
                      ? "bg-amber-500"
                      : "bg-red-400"
                )}
                style={{ width: `${Math.min(100, (order.paid_amount / (order.total_amount || 1)) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                {formatPrice(order.paid_amount)} / {formatPrice(order.total_amount)}
              </span>
              {order.is_paid ? (
                <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Payé
                </Badge>
              ) : order.paid_amount > 0 ? (
                <Badge className="bg-amber-100 text-amber-800 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Avance versée
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Non payé
                </Badge>
              )}
            </div>

            {overpaidAmount > 0 && (
              <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                Trop-percu apres remise: {formatPrice(overpaidAmount)}
              </div>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground">Historique</p>
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs py-0">
                        {paymentTypeLabels[payment.payment_type]}
                      </Badge>
                      <span className="text-muted-foreground">
                        {paymentMethodLabels[payment.payment_method]}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-600">
                      +{formatPrice(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Record payment button */}
            <div className="flex gap-2">
              {!order.is_paid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  {order.paid_amount > 0 ? "Encaisser le solde" : "Enregistrer un paiement"}
                </Button>
              )}
              {order.status !== "delivered" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  setDiscountAmountInput(String(discountAmount || 0));
                  setDiscountReason(order.discount_reason || "");
                  setDiscountDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {discountAmount > 0 ? "Modifier la remise" : "Accorder une remise"}
              </Button>
              )}
            </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Signature */}
          {order.signature_url && (
            <Collapsible defaultOpen={false} className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Signature Client
                </h4>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-center mt-1">
                  <img
                    src={order.signature_url}
                    alt="Signature du client"
                    className="max-h-24 object-contain"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Dates */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Créé le {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}</span>
            </div>
            {order.estimated_date && (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <span>Prévu le {format(new Date(order.estimated_date), "d MMM", { locale: fr })}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isReceived && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="touch-target border-destructive text-destructive hover:bg-destructive/10"
                    disabled={deleteOrder.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Annuler la commande
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprime definitivement la commande et ses elements associes.
                    </AlertDialogDescription>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Motif d'annulation</p>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Ex: Client n'a pas donne son accord final"
                        rows={3}
                      />
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelReason("")}>Retour</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteOrder.isPending || !cancelReason.trim()}
                      onClick={() =>
                        deleteOrder.mutate(
                          { orderId: order.id, cancelReason },
                          {
                            onSuccess: () => {
                              setCancelReason("");
                              onClose();
                            },
                          }
                        )
                      }
                    >
                      Confirmer l'annulation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {nextStatus && (
              <Button
                className="flex-1 touch-target"
                onClick={handleAdvanceStatus}
                disabled={advanceStatus.isPending}
              >
                {advanceStatus.isPending ? "Mise à jour..." : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Passer à "{statusLabels[nextStatus]}"
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" className="touch-target" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PartnerAssignmentDialog
        open={assignmentDialogOpen}
        onClose={() => {
          setAssignmentDialogOpen(false);
          setSelectedItem(null);
        }}
        orderItem={selectedItem}
      />

      <AddServiceDialog
        open={addServiceDialogOpen}
        onOpenChange={setAddServiceDialogOpen}
        orderId={order.id}
        articleId={addServiceArticleId}
        articleLabel={addServiceArticleLabel}
      />

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accorder une remise</DialogTitle>
            <DialogDescription>
              Appliquez une remise negociee en fin de commande. Le montant initial est conserve pour l'historique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sous-total initial</span>
                <span className="font-medium">{formatPrice(subtotalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deja encaisse</span>
                <span className="font-medium">{formatPrice(order.paid_amount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-amount">Montant de la remise</Label>
              <Input
                id="discount-amount"
                type="number"
                min={0}
                max={subtotalAmount}
                value={discountAmountInput}
                onChange={(e) => setDiscountAmountInput(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-reason">Motif</Label>
              <Textarea
                id="discount-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Ex: geste commercial de fin de commande"
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nouveau total</span>
                <span className="font-semibold">
                  {formatPrice(Math.max(0, subtotalAmount - (Number(discountAmountInput) || 0)))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reste a payer</span>
                <span className="font-semibold text-amber-700">
                  {formatPrice(Math.max(0, Math.max(0, subtotalAmount - (Number(discountAmountInput) || 0)) - order.paid_amount))}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleApplyDiscount}
              disabled={applyOrderDiscount.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {applyOrderDiscount.isPending ? "Enregistrement..." : "Valider la remise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!order.is_paid && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setPickupSuggestedAmount(undefined);
          }}
          orderId={order.id}
          totalAmount={order.total_amount}
          paidAmount={order.paid_amount}
          suggestedType="balance"
          suggestedAmount={pickupSuggestedAmount}
        />
      )}

      <OrderSendToPartnerDialog
        open={sendToPartnerDialogOpen}
        onClose={() => setSendToPartnerDialogOpen(false)}
        order={order}
        onSuccess={() => setSendToPartnerDialogOpen(false)}
      />

      <OrderReceiveFromPartnerDialog
        open={receiveFromPartnerDialogOpen}
        onClose={() => setReceiveFromPartnerDialogOpen(false)}
        order={order}
        onSuccess={() => setReceiveFromPartnerDialogOpen(false)}
      />

      {/* Photo Preview Lightbox */}
      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80">
              <p className="text-sm font-medium text-white/90 truncate">
                {previewPhoto?.label}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/10 gap-2"
                  onClick={() => previewPhoto && handleDownloadPhoto(previewPhoto.url, previewPhoto.filename)}
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </div>
            {/* Image */}
            <div className="flex items-center justify-center p-4 min-h-[300px] max-h-[70vh]">
              {previewPhoto && (
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.label}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
