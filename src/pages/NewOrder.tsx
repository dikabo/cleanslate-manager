import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  articleTypeLabels,
  materialLabels,
  ArticleType,
  Material,
  ServiceCategory,
  PaymentMethod,
  paymentMethodLabels,
} from "@/types";
import {
  useServices,
  serviceCategories,
  getServicesByCategoryFromList,
  getServiceDisplayName,
  formatPrice,
  isOtherService,
  DbService,
} from "@/hooks/useServices";
import {
  useArticleCategories,
  useCreateArticleCategory,
  getArticleTypeDisplayName,
} from "@/hooks/useArticleCategories";
import { PhotoUpload } from "@/components/orders/PhotoUpload";
import { uploadWithRetry } from "@/lib/image-utils";
import { SignaturePad } from "@/components/orders/SignaturePad";
import {
  Camera,
  User,
  Search,
  Plus,
  X,
  ArrowLeft,
  Check,
  Package,
  Trash2,
  Banknote,
  Smartphone,
  CreditCard,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ArticleItem {
  id: string;
  articleType: ArticleType;
  customArticleType: string;
  material: Material;
  brand: string;
  color: string;
  description: string;
  services: Array<{ service: DbService; price: number; notes?: string; customName?: string }>;
  photos: Array<{ url: string; file?: File }>;
}

const paymentMethodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  transfer: <ArrowRightLeft className="h-4 w-4" />,
};

export default function NewOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Client State
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  // Articles State
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [currentArticleIndex, setCurrentArticleIndex] = useState<number | null>(null);

  // Current article being edited
  const [articleType, setArticleType] = useState<ArticleType | "">("");
  const [customArticleType, setCustomArticleType] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [material, setMaterial] = useState<Material | "">("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [selectedServices, setSelectedServices] = useState<Array<{ service: DbService; price: number; notes?: string; customName?: string }>>([]);
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("cordonnerie_homme");
  const [currentPhotos, setCurrentPhotos] = useState<Array<{ url: string; file?: File }>>([]);

  // Diagnosis & Signature
  const [diagnosis, setDiagnosis] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  // Payment State
  const [collectAdvance, setCollectAdvance] = useState(true);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [fullPayment, setFullPayment] = useState(false);

  // Custom order date (for past orders)
  const [orderDate, setOrderDate] = useState<string>("");

  // Fetch services from DB
  const { data: dbServices = [] } = useServices();
  const { data: customCategories = [] } = useArticleCategories();
  const createCategory = useCreateArticleCategory();

  // Fetch existing clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Pre-fill client from URL params (e.g. /orders/new?clientId=xxx)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const clientIdParam = searchParams.get("clientId");
    if (clientIdParam && clients.length > 0 && !selectedClientId) {
      const found = clients.find((c) => c.id === clientIdParam);
      if (found) {
        setSelectedClientId(found.id);
        setStep(2); // Skip to article step
      }
    }
  }, [searchParams, clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone?.includes(clientSearch)
    );
  }, [clients, clientSearch]);

  // Calculate totals
  const currentArticleTotal = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.price, 0);
  }, [selectedServices]);

  const allArticlesTotal = useMemo(() => {
    return articles.reduce(
      (sum, a) => sum + a.services.reduce((s, srv) => s + srv.price, 0),
      0
    ) + (currentArticleIndex === null ? currentArticleTotal : 0);
  }, [articles, currentArticleIndex, currentArticleTotal]);

  const hasMissingCustomName = selectedServices.some(
    (s) => isOtherService(s.service) && !s.customName?.trim()
  );

  // Update suggested advance when total changes
  useEffect(() => {
    if (allArticlesTotal > 0 && advanceAmount === 0) {
      setAdvanceAmount(Math.round(allArticlesTotal * 0.5));
    }
    if (advanceAmount > allArticlesTotal) {
      setAdvanceAmount(allArticlesTotal);
    }
  }, [allArticlesTotal, advanceAmount]);

  const saveCurrentArticle = () => {
    if (!articleType || !material) return;

    const articleData: ArticleItem = {
      id: currentArticleIndex !== null ? articles[currentArticleIndex].id : crypto.randomUUID(),
      articleType: articleType as ArticleType,
      customArticleType,
      material: material as Material,
      brand,
      color,
      description,
      services: selectedServices,
      photos: currentPhotos,
    };

    if (currentArticleIndex !== null) {
      const updated = [...articles];
      updated[currentArticleIndex] = articleData;
      setArticles(updated);
    } else {
      setArticles([...articles, articleData]);
    }

    resetArticleForm();
  };

  const resetArticleForm = () => {
    setCurrentArticleIndex(null);
    setArticleType("");
    setCustomArticleType("");
    setShowCustomInput(false);
    setMaterial("");
    setBrand("");
    setColor("");
    setDescription("");
    setSelectedServices([]);
    setCurrentPhotos([]);
  };

  const editArticle = (index: number) => {
    const article = articles[index];
    setCurrentArticleIndex(index);
    setArticleType(article.articleType);
    setCustomArticleType(article.customArticleType);
    setShowCustomInput(false);
    setMaterial(article.material);
    setBrand(article.brand);
    setColor(article.color);
    setDescription(article.description);
    setSelectedServices(article.services);
    setCurrentPhotos(article.photos);
  };

  const removeArticle = (index: number) => {
    setArticles(articles.filter((_, i) => i !== index));
    if (currentArticleIndex === index) resetArticleForm();
  };

  const toggleService = (service: DbService) => {
    const exists = selectedServices.find((s) => s.service.id === service.id);
    if (exists) {
      setSelectedServices(selectedServices.filter((s) => s.service.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, { service, price: service.base_price }]);
    }
  };

  const updateServicePrice = (serviceId: string, price: number) => {
    setSelectedServices(
      selectedServices.map((s) =>
        s.service.id === serviceId ? { ...s, price } : s
      )
    );
  };

  const updateServiceCustomName = (serviceId: string, customName: string) => {
    setSelectedServices(
      selectedServices.map((s) =>
        s.service.id === serviceId ? { ...s, customName } : s
      )
    );
  };

  // Upload photos helper — sequential with retry + progress
  const uploadPhotos = async (orderId: string, articleId: string | null, articlePhotos: Array<{ url: string; file?: File }>) => {
    const photosWithFiles = articlePhotos.filter(p => p.file);
    let uploadedCount = 0;
    let failedCount = 0;

    for (const photo of photosWithFiles) {
      if (!photo.file) continue;
      try {
        const ext = photo.file.name.split(".").pop() || "jpg";
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const path = `${orderId}/before/${uniqueId}.${ext}`;

        // Show progress
        uploadedCount++;
        toast.info(`Photo ${uploadedCount}/${photosWithFiles.length} en cours...`, { id: "photo-progress" });

        // Upload with timeout + retry
        const publicUrl = await uploadWithRetry(supabase, "order-photos", path, photo.file, 3, 45000);

        const photoData: any = {
          order_id: orderId,
          url: publicUrl,
          type: "before",
        };

        if (articleId) {
          photoData.article_id = articleId;
        }

        const { error: dbError } = await supabase.from("photos").insert(photoData);
        if (dbError) throw new Error(`Database (${dbError.message})`);
      } catch (error) {
        failedCount++;
        console.warn(`Photo ${uploadedCount} échouée:`, error);
        // Continue with next photo instead of blocking
      }
    }

    toast.dismiss("photo-progress");
    const actualSuccess = uploadedCount - failedCount;
    if (actualSuccess > 0) {
      toast.success(`${actualSuccess} photo(s) traitée(s)`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} photo(s) non envoyée(s). Vérifiez votre connexion.`, { duration: 6000 });
    }
  };

  // Upload signature helper
  const uploadSignature = async (orderId: string, dataUrl: string): Promise<string> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const path = `${orderId}/signature.png`;
    const { error } = await supabase.storage
      .from("order-photos")
      .upload(path, blob, { contentType: "image/png" });
    if (error) throw error;
    const { data } = supabase.storage.from("order-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  // Track order ID to prevent duplicates on retry
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      let clientId = selectedClientId;

      if (!clientId && newClientName && newClientPhone) {
        // Check if client already exists (prevent duplicate on retry)
        const { data: existingClients } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", newClientPhone)
          .limit(1);

        if (existingClients && existingClients.length > 0) {
          clientId = existingClients[0].id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({ name: newClientName, phone: newClientPhone })
            .select()
            .single();
          if (clientError) throw new Error(`[Client] ${clientError.message}`);
          clientId = newClient.id;
        }
      }

      if (!clientId) throw new Error("Client requis");

      const allArticles = [...articles];
      if (articleType && material && selectedServices.length > 0 && currentArticleIndex === null) {
        allArticles.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          articleType: articleType as ArticleType,
          customArticleType,
          material: material as Material,
          brand, color, description,
          services: selectedServices,
          photos: currentPhotos,
        });
      }

      if (allArticles.length === 0) throw new Error("Au moins un article requis");
      if (
        allArticles.some((article) =>
          article.services.some(
            (srv) => isOtherService(srv.service) && !srv.customName?.trim()
          )
        )
      ) {
        throw new Error("Nommez chaque service Autres");
      }

      const totalAmount = allArticles.reduce(
        (sum, a) => sum + a.services.reduce((s, srv) => s + srv.price, 0),
        0
      );

      // Persist any new custom categories
      for (const a of allArticles) {
        if (a.articleType === "other" && a.customArticleType?.trim()) {
          await createCategory.mutateAsync(a.customArticleType.trim());
        }
      }

      let orderId = createdOrderId;

      // Only create order if not already created (prevents duplicates)
      if (!orderId) {
        // Generate new short ticket number YYMMDDHHmmXXXX
        const dateToUse = orderDate ? new Date(orderDate) : new Date();
        const dateStr = format(dateToUse, "yyMMddHHmm");
        const randomChar = Math.random().toString(36).substring(2, 6).toUpperCase();
        const tempTicket = `${dateStr}${randomChar}`;

        const orderPayload: any = {
          client_id: clientId,
          article_type: allArticles[0].articleType,
          custom_article_type: allArticles[0].articleType === "other" ? allArticles[0].customArticleType || null : null,
          material: allArticles[0].material,
          brand: allArticles[0].brand || null,
          color: allArticles[0].color || null,
          diagnosis,
          subtotal_amount: totalAmount,
          discount_amount: 0,
          total_amount: totalAmount,
          paid_amount: 0,
          is_paid: false,
          ticket_number: tempTicket,
        };

        if (orderDate) {
          orderPayload.created_at = new Date(orderDate).toISOString();
        }

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert(orderPayload)
          .select()
          .single();

        if (orderError) throw new Error(`[Commande] ${orderError.message}`);
        orderId = order.id;
        setCreatedOrderId(orderId);
      }

      // From here on, the order exists. Wrap subsequent steps so we can
      // still succeed even if a non-critical step fails.
      const warnings: string[] = [];

      // Upload signature
      try {
        if (signatureDataUrl) {
          const signatureUrl = await uploadSignature(orderId, signatureDataUrl);
          const { error: sigError } = await supabase
            .from("orders")
            .update({ signature_url: signatureUrl })
            .eq("id", orderId);
          if (sigError) warnings.push(`Signature: ${sigError.message}`);
        }
      } catch (e: unknown) {
        warnings.push(`Signature: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Create order_articles
      let articleIds: string[] = [];
      try {
        const { data: existingArticles } = await supabase
          .from("order_articles")
          .select("id")
          .eq("order_id", orderId);

        if (!existingArticles || existingArticles.length === 0) {
          const articlesData = allArticles.map((a, i) => ({
            order_id: orderId,
            article_type: a.articleType,
            custom_article_type: a.articleType === "other" ? a.customArticleType || null : null,
            material: a.material,
            brand: a.brand || null,
            color: a.color || null,
            description: a.description || null,
            position: i + 1,
          }));

          const { data: createdArticles, error: articlesError } = await supabase
            .from("order_articles")
            .insert(articlesData)
            .select();

          if (articlesError) {
            warnings.push(`Articles: ${articlesError.message}`);
          } else {
            articleIds = createdArticles.map((a: { id: string }) => a.id);
          }
        } else {
          articleIds = existingArticles.map((a) => a.id);
        }
      } catch (e: unknown) {
        warnings.push(`Articles: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Create order_items (only if articles were created)
      if (articleIds.length > 0) {
        try {
          const { data: existingItems } = await supabase
            .from("order_items")
            .select("id")
            .eq("order_id", orderId);

          if (!existingItems || existingItems.length === 0) {
            const itemsData: Array<{
              order_id: string;
              article_id: string;
              service_id: string;
              service_name: string;
              price: number;
              notes: string | null;
            }> = [];

            allArticles.forEach((article, articleIndex) => {
              const articleId = articleIds[articleIndex];
              if (!articleId) return;
              article.services.forEach((srv) => {
                itemsData.push({
                  order_id: orderId!,
                  article_id: articleId,
                  service_id: srv.service.id,
                  service_name: getServiceDisplayName(srv.service, srv.customName),
                  price: srv.price,
                  notes: srv.notes || null,
                });
              });
            });

            if (itemsData.length > 0) {
              const { error: itemsError } = await supabase.from("order_items").insert(itemsData);
              if (itemsError) warnings.push(`Services: ${itemsError.message}`);
            }
          }
        } catch (e: unknown) {
          warnings.push(`Services: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Upload photos (sequential per article — skip if photos already exist for this order)
      try {
        const { data: existingPhotos } = await supabase
          .from('photos')
          .select('id')
          .eq('order_id', orderId);

        if (!existingPhotos || existingPhotos.length === 0) {
          for (let i = 0; i < allArticles.length; i++) {
            const article = allArticles[i];
            const articleId = articleIds[i] || null;
            if (article.photos.length > 0) {
              await uploadPhotos(orderId!, articleId, article.photos);
            }
          }
        } else {
          console.log(`Photos déjà uploadées (${existingPhotos.length}), upload ignoré.`);
        }
      } catch (e: unknown) {
        warnings.push(`Photos: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Record initial payment (advance)
      if (collectAdvance && advanceAmount > 0) {
        try {
          const paymentAmount = fullPayment
            ? totalAmount
            : Math.max(0, Math.min(advanceAmount, totalAmount));
          const paymentPayload: any = {
            order_id: orderId,
            amount: paymentAmount,
            payment_type: fullPayment ? 'balance' : 'advance',
            payment_method: paymentMethod,
            reference: paymentReference || null,
          };

          if (orderDate) {
            paymentPayload.created_at = new Date(orderDate).toISOString();
          }

          const { error: paymentError } = await supabase.from("payments").insert(paymentPayload);
          if (paymentError) {
            warnings.push(`Paiement: ${paymentError.message}`);
          } else {
            // Update order paid_amount
            const isPaid = paymentAmount >= totalAmount;
            const { error: updatePayError } = await supabase
              .from("orders")
              .update({ paid_amount: paymentAmount, is_paid: isPaid })
              .eq("id", orderId);
            if (updatePayError) warnings.push(`MAJ paiement: ${updatePayError.message}`);
          }
        } catch (e: unknown) {
          warnings.push(`Paiement: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Fetch the final order
      const { data: finalOrder, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchError) throw new Error(`[Récupération] ${fetchError.message}`);

      return { order: finalOrder, warnings };
    },
    onSuccess: ({ order, warnings }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      if (warnings.length > 0) {
        console.warn("Order creation warnings:", warnings);
        toast.warning(`Commande créée avec des avertissements: ${warnings.join(", ")}`, { duration: 6000 });
      } else {
        toast.success(`Commande ${order.ticket_number} créée avec succès!`);
      }
      navigate("/orders");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="touch-target">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Nouvelle Commande</h1>
            <p className="text-muted-foreground">Étape {step} sur 3</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn("h-2 flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>

        {/* Step 1: Client */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Date de réception (Optionnelle)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Date et heure de la commande</Label>
                  <Input
                    type="datetime-local"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full md:w-1/2"
                  />
                  <p className="text-sm text-muted-foreground">
                    Laissez vide pour utiliser la date et l'heure actuelles. Utile pour enregistrer une commande passée.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un client (nom ou téléphone)..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSelectedClientId(null);
                    }}
                    className="pl-10"
                  />
                </div>

                {clientSearch && !selectedClientId && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setClientSearch(client.name);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setNewClientName(clientSearch);
                        setSelectedClientId(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Plus className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">Créer "{clientSearch}"</p>
                        <p className="text-sm text-muted-foreground">Nouveau client</p>
                      </div>
                    </button>
                  </div>
                )}

                {!selectedClientId && newClientName && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <h4 className="font-semibold">Nouveau client</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nom complet" />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone *</Label>
                        <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Ex: 77 123 45 67" />
                      </div>
                    </div>
                  </div>
                )}

                {selectedClient && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <Check className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <span className="font-medium">{selectedClient.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">{selectedClient.phone}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedClientId(null); setClientSearch(""); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={() => setStep(2)}
              disabled={!selectedClientId && (!newClientName || !newClientPhone)}
              className="w-full touch-target"
              size="lg"
            >
              Continuer vers les Articles
            </Button>
          </div>
        )}

        {/* Step 2: Articles & Services */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Articles List */}
            {articles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Articles ajoutés ({articles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {articles.map((article, index) => (
                    <div
                      key={article.id}
                      className={cn(
                        "p-4 rounded-lg border-2 transition-all",
                        currentArticleIndex === index ? "border-primary bg-primary/5" : "border-border"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{getArticleTypeDisplayName(article.articleType, article.customArticleType)}</Badge>
                            <Badge variant="outline">{materialLabels[article.material]}</Badge>
                            {article.brand && <span className="text-sm text-muted-foreground">{article.brand}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {article.services.length} service(s) - {article.photos.length} photo(s) -{" "}
                            <span className="font-semibold text-foreground">
                              {formatPrice(article.services.reduce((s, srv) => s + srv.price, 0))}
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => editArticle(index)}>Modifier</Button>
                          <Button variant="ghost" size="sm" onClick={() => removeArticle(index)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Current Article Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {currentArticleIndex !== null ? `Modifier l'article ${currentArticleIndex + 1}` : "Ajouter un article"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type d'article *</Label>
                    <Select
                      value={showCustomInput ? "__new__" : (articleType === "other" && customArticleType ? `custom:${customArticleType}` : articleType)}
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setArticleType("other" as ArticleType);
                          setCustomArticleType("");
                          setShowCustomInput(true);
                        } else if (v.startsWith("custom:")) {
                          setArticleType("other" as ArticleType);
                          setCustomArticleType(v.replace("custom:", ""));
                          setShowCustomInput(false);
                        } else {
                          setArticleType(v as ArticleType);
                          setCustomArticleType("");
                          setShowCustomInput(false);
                        }
                      }}
                    >
                      <SelectTrigger className="touch-target"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(articleTypeLabels)
                          .filter(([key]) => key !== "other")
                          .map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
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
                          <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Autre (nouvelle catégorie)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showCustomInput && (
                      <Input
                        value={customArticleType}
                        onChange={(e) => setCustomArticleType(e.target.value)}
                        placeholder="Nom de la catégorie (ex: Chapeau, Montre...)"
                        className="mt-1.5"
                        autoFocus
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Matière *</Label>
                    <Select value={material} onValueChange={(v) => setMaterial(v as Material)}>
                      <SelectTrigger className="touch-target"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(materialLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marque</Label>
                    <Input placeholder="Ex: Nike, Gucci..." value={brand} onChange={(e) => setBrand(e.target.value)} className="touch-target" />
                  </div>
                  <div className="space-y-2">
                    <Label>Couleur</Label>
                    <Input placeholder="Ex: Noir, Marron..." value={color} onChange={(e) => setColor(e.target.value)} className="touch-target" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description / Notes</Label>
                  <Textarea placeholder="Description de l'article, défauts observés..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>

                {/* Photos */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos "Avant" (obligatoire)
                  </Label>
                  <PhotoUpload
                    type="before"
                    localMode
                    existingPhotos={currentPhotos as any}
                    onPhotosChange={(photos) => setCurrentPhotos(photos)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Services Selection */}
            {articleType && material && (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(Object.keys(serviceCategories) as ServiceCategory[]).map((cat) => (
                    <Button
                      key={cat}
                      variant={activeCategory === cat ? "default" : "outline"}
                      onClick={() => setActiveCategory(cat)}
                      className="whitespace-nowrap touch-target"
                    >
                      {serviceCategories[cat]}
                    </Button>
                  ))}
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {getServicesByCategoryFromList(dbServices, activeCategory).map((service) => {
                        const isSelected = selectedServices.some((s) => s.service.id === service.id);
                        const selectedService = selectedServices.find((s) => s.service.id === service.id);

                        return (
                          <div
                            key={service.id}
                            onClick={() => toggleService(service)}
                            className={cn(
                              "p-4 rounded-lg border-2 cursor-pointer transition-all touch-target",
                              isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-foreground">
                                  {getServiceDisplayName(service, selectedService?.customName)}
                                </p>
                                {service.is_custom_price && (
                                  <span className="text-xs text-muted-foreground">À partir de</span>
                                )}
                              </div>
                              <div className="text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    value={selectedService?.price || 0}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateServicePrice(service.id, parseInt(e.target.value) || 0);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-24 h-8 text-right"
                                  />
                                ) : (
                                  <span className="font-semibold">
                                    {service.base_price > 0 ? formatPrice(service.base_price) : "Sur devis"}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-primary" />
                                <span className="text-sm text-primary font-medium">Sélectionné</span>
                                </div>
                                {isOtherService(service) && (
                                  <Input
                                    value={selectedService?.customName || ""}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateServiceCustomName(service.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Nom du service"
                                    className="h-9"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedServices.length > 0 && (
                  <Button
                    onClick={saveCurrentArticle}
                    disabled={hasMissingCustomName}
                    className="w-full touch-target"
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {currentArticleIndex !== null ? "Mettre à jour l'article" : "Ajouter cet article"}
                  </Button>
                )}
              </>
            )}

            {/* Summary */}
            {(articles.length > 0 || selectedServices.length > 0) && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Total ({articles.length + (selectedServices.length > 0 ? 1 : 0)} article(s))
                    </span>
                    <span className="text-xl font-bold text-primary">{formatPrice(allArticlesTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Diagnosis */}
            <Card>
              <CardHeader><CardTitle>Diagnostic général</CardTitle></CardHeader>
              <CardContent>
                <Textarea placeholder="Notes générales sur la commande..." value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} />
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 touch-target" size="lg">
                Retour
              </Button>
              <Button
                onClick={() => {
                  if (articleType && material && selectedServices.length > 0 && currentArticleIndex === null) {
                    saveCurrentArticle();
                  }
                  setStep(3);
                }}
                disabled={
                  (articles.length === 0 && selectedServices.length === 0) ||
                  hasMissingCustomName
                }
                className="flex-1 touch-target"
                size="lg"
              >
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Récapitulatif de la commande</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Client */}
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedClient?.name || newClientName}</p>
                  <p className="text-sm text-muted-foreground">{selectedClient?.phone || newClientPhone}</p>
                </div>

                <Separator />

                {/* Articles */}
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Articles ({articles.length})</p>
                  <div className="space-y-4">
                    {articles.map((article) => (
                      <div key={article.id} className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>{getArticleTypeDisplayName(article.articleType, article.customArticleType)}</Badge>
                          <Badge variant="outline">{materialLabels[article.material]}</Badge>
                          {article.brand && <span className="text-sm">{article.brand}</span>}
                          {article.color && <span className="text-sm text-muted-foreground">- {article.color}</span>}
                        </div>
                        {article.photos.length > 0 && (
                          <div className="flex gap-1 mb-2">
                            {article.photos.slice(0, 3).map((p, i) => (
                              <img key={i} src={p.url} alt="" className="w-12 h-12 rounded object-cover" />
                            ))}
                            {article.photos.length > 3 && (
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                +{article.photos.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-1">
                          {article.services.map(({ service, price, customName }) => (
                            <div key={service.id} className="flex justify-between text-sm">
                              <span>{getServiceDisplayName(service, customName)}</span>
                              <span className="font-medium">{formatPrice(price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total à payer</span>
                  <span className="text-2xl font-bold text-primary">{formatPrice(allArticlesTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Collection */}
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  Encaissement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="collect-advance"
                    checked={collectAdvance}
                    onCheckedChange={(checked) => setCollectAdvance(checked === true)}
                  />
                  <Label htmlFor="collect-advance" className="text-sm cursor-pointer">
                    Encaisser une avance maintenant
                  </Label>
                </div>

                {collectAdvance && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Full payment checkbox */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="full-payment"
                        checked={fullPayment}
                        onCheckedChange={(checked) => {
                          setFullPayment(checked === true);
                          if (checked) setAdvanceAmount(allArticlesTotal);
                          else setAdvanceAmount(Math.round(allArticlesTotal * 0.5));
                        }}
                      />
                      <Label htmlFor="full-payment" className="text-sm cursor-pointer">
                        Paiement intégral
                      </Label>
                    </div>

                    {/* Amount */}
                    {!fullPayment && (
                      <div className="space-y-2">
                        <Label>Montant de l'avance (FCFA)</Label>
                        <Input
                          type="number"
                          value={advanceAmount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setAdvanceAmount(Math.max(0, Math.min(val, allArticlesTotal)));
                          }}
                          className="font-semibold"
                        />
                        <div className="flex gap-2">
                          {[25, 50, 75].map((pct) => (
                            <Button
                              key={pct}
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setAdvanceAmount(Math.round(allArticlesTotal * pct / 100))}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <Label>Méthode de paiement</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={cn(
                              "flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-sm",
                              paymentMethod === method
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-border hover:border-emerald-300"
                            )}
                          >
                            {paymentMethodIcons[method]}
                            <span className="font-medium text-xs">{paymentMethodLabels[method]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reference for non-cash */}
                    {paymentMethod !== "cash" && (
                      <div className="space-y-2">
                        <Label>Référence de transaction</Label>
                        <Input
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="N° transaction, référence..."
                        />
                      </div>
                    )}

                    {/* Summary */}
                    <div className="p-3 bg-white rounded-lg border space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total commande</span>
                        <span className="font-medium">{formatPrice(allArticlesTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {fullPayment ? "Paiement intégral" : "Avance"}
                        </span>
                        <span className="font-semibold text-emerald-600">
                          {formatPrice(fullPayment ? allArticlesTotal : advanceAmount)}
                        </span>
                      </div>
                      {!fullPayment && (
                        <div className="flex justify-between text-sm border-t pt-1">
                          <span className="text-muted-foreground">Reste à payer</span>
                          <span className="font-semibold text-amber-600">
                            {formatPrice(allArticlesTotal - advanceAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardHeader><CardTitle>Signature du client</CardTitle></CardHeader>
              <CardContent>
                <SignaturePad onSignatureChange={setSignatureDataUrl} />
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 touch-target" size="lg">
                Retour
              </Button>
              <Button
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending}
                className="flex-1 touch-target bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                {createOrderMutation.isPending ? "Création..." : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Valider la commande
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
