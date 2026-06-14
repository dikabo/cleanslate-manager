import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Building, Package, Clock, ExternalLink, PackageCheck, FileText, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ReceiveItemDialog } from "@/components/partners/ReceiveItemDialog";
import { printDeliveryNote } from "@/components/documents/DeliveryNoteLayout";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, ZoomIn, Download, X } from "lucide-react";

import { OrderItem, Partner } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";

interface PartnerLogisticsItem extends OrderItem {
  orders: {
    id: string;
    ticket_number: string;
    clients: { name: string } | null;
  } | null;
  partners: Partner | null;
  order_articles?: {
    id: string;
    article_type: string;
    brand: string;
    photos: { url: string; type: string }[];
  } | null;
}

export default function PartnerLogistics() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<PartnerLogisticsItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string; filename: string } | null>(null);

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
      window.open(url, '_blank');
    }
  };

  // Get all items currently at partners
  const { data: itemsAtPartners, isLoading } = useQuery({
    queryKey: ['items-at-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          orders (
            id,
            ticket_number,
            clients (name)
          ),
          partners (
            id,
            name,
            specialty,
            phone,
            address
          ),
          order_articles (
            id,
            article_type,
            brand,
            photos (url, type)
          )
        `)
        .in('status', ['sent_to_partner', 'at_partner'])
        .not('assigned_to_partner_id', 'is', null)
        .order('sent_to_partner_at', { ascending: true });

      if (error) throw error;
      return data as PartnerLogisticsItem[];
    }
  });

  // Recently received items (last 7 days)
  const { data: recentlyReceived } = useQuery({
    queryKey: ['recently-received-items'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          orders (
            id,
            ticket_number,
            clients (name)
          ),
          partners (
            id,
            name,
            specialty,
            phone
          ),
          order_articles (
            id,
            article_type,
            brand,
            photos (url, type)
          )
        `)
        .eq('status', 'received_from_partner')
        .not('received_from_partner_at', 'is', null)
        .gte('received_from_partner_at', sevenDaysAgo.toISOString())
        .order('received_from_partner_at', { ascending: false });

      if (error) throw error;
      return data as PartnerLogisticsItem[];
    }
  });

  // Group items by partner
  const partnersWithItems = useMemo(() => {
    const map = itemsAtPartners?.reduce((acc, item) => {
      const partnerId = item.assigned_to_partner_id;
      if (!partnerId) return acc;

      if (!acc[partnerId]) {
        acc[partnerId] = {
          partner: item.partners,
          items: []
        };
      }
      acc[partnerId].items.push(item);
      return acc;
    }, {} as Record<string, { partner: Partner | null; items: PartnerLogisticsItem[] }>) || {};
    return Object.values(map);
  }, [itemsAtPartners]);
  const totalItems = itemsAtPartners?.length || 0;

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAllForPartner = (partnerItems: PartnerLogisticsItem[]) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      const allSelected = partnerItems.every((i) => next.has(i.id));
      if (allSelected) {
        partnerItems.forEach((i) => next.delete(i.id));
      } else {
        partnerItems.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const handleReceive = (item: PartnerLogisticsItem) => {
    setReceiveItem(item);
    setReceiveDialogOpen(true);
  };

  const handlePrintDeliveryNote = () => {
    if (selectedItems.size === 0) return;

    // Group selected items by partner
    const selectedByPartner = new Map<string, { partner: Partner | null; items: PartnerLogisticsItem[] }>();

    itemsAtPartners?.forEach((item) => {
      if (!selectedItems.has(item.id)) return;
      const pid = item.assigned_to_partner_id;
      if (!pid) return;
      if (!selectedByPartner.has(pid)) {
        selectedByPartner.set(pid, { partner: item.partners, items: [] });
      }
      selectedByPartner.get(pid)!.items.push(item);
    });

    // Generate one note per partner
    selectedByPartner.forEach(({ partner, items }) => {
      printDeliveryNote({
        partnerName: partner.name,
        partnerPhone: partner.phone,
        partnerAddress: partner.address,
        type: "send",
        items: items.map((it) => ({
          ticketNumber: it.orders?.ticket_number || "—",
          clientName: it.orders?.clients?.name || "—",
          serviceName: it.service_name,
          sentAt: it.sent_to_partner_at || new Date().toISOString(),
        })),
      });
    });

    setSelectedItems(new Set());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent_to_partner':
        return <Badge className="bg-orange-100 text-orange-800">En transit</Badge>;
      case 'at_partner':
        return <Badge className="bg-blue-100 text-blue-800">Chez partenaire</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDurationBadge = (sentAt: string | null) => {
    if (!sentAt) return null;
    const days = differenceInDays(new Date(), new Date(sentAt));
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs",
          days > 7 ? "border-red-300 text-red-700" :
            days > 3 ? "border-amber-300 text-amber-700" :
              "border-emerald-300 text-emerald-700"
        )}
      >
        {days}j
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Logistique Partenaires
            </h1>
            <p className="text-muted-foreground">
              Suivi des envois et réceptions chez les prestataires
            </p>
          </div>
          {selectedItems.size > 0 && (
            <Button onClick={handlePrintDeliveryNote} className="gap-2">
              <FileText className="h-4 w-4" />
              Bordereau ({selectedItems.size} article{selectedItems.size > 1 ? "s" : ""})
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-100">
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalItems}</p>
                  <p className="text-sm text-muted-foreground">En externe</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{partnersWithItems.length}</p>
                  <p className="text-sm text-muted-foreground">Partenaires</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <ExternalLink className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {itemsAtPartners?.filter(i => i.status === 'sent_to_partner').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">En transit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recentlyReceived?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Reçus (7j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <Package className="h-4 w-4" />
              En cours ({totalItems})
            </TabsTrigger>
            <TabsTrigger value="received" className="gap-2">
              <PackageCheck className="h-4 w-4" />
              Réceptionnés ({recentlyReceived?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Active Tab */}
          <TabsContent value="active">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Chargement...
              </div>
            ) : partnersWithItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Aucun article chez les partenaires</p>
                  <p className="text-sm">Tous les articles sont actuellement en atelier</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {partnersWithItems.map(({ partner, items }) => (
                  <Card key={partner.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Building className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <span className="text-lg">{partner.name}</span>
                            <p className="text-sm text-muted-foreground font-normal">
                              {partner.phone || 'Pas de téléphone'}
                            </p>
                          </div>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => selectAllForPartner(items)}
                          >
                            {items.every((i: PartnerLogisticsItem) => selectedItems.has(i.id))
                              ? "Tout désélectionner"
                              : "Tout sélectionner"}
                          </Button>
                          <Badge variant="outline" className="text-lg px-4 py-1">
                            {items.length} article{items.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y">
                        {items.map((item: PartnerLogisticsItem) => (
                          <div
                            key={item.id}
                            className="py-3 flex items-center gap-3"
                          >
                            {/* Checkbox */}
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                            />

                            {/* Thumbnail */}
                            {(() => {
                              const article = item.order_articles;
                              const beforePhoto = article?.photos?.find(p => p.type === 'before')?.url;
                              
                              if (beforePhoto) {
                                const articleLabel = article ? `${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` (${article.brand})` : ''}` : 'Article';
                                return (
                                  <div 
                                    className="relative group w-12 h-12 rounded overflow-hidden cursor-pointer flex-shrink-0 border"
                                    onClick={() => setPreviewPhoto({
                                      url: beforePhoto,
                                      label: `Avant — ${articleLabel}`,
                                      filename: `photo-avant-${item.orders?.ticket_number}-${article.id}.jpg`
                                    })}
                                  >
                                    <img src={beforePhoto} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 border">
                                    <Camera className="h-4 w-4 text-muted-foreground/40" />
                                  </div>
                                );
                              }
                            })()}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.service_name}</span>
                                {getStatusBadge(item.status)}
                                {getDurationBadge(item.sent_to_partner_at)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.orders?.ticket_number} • {item.orders?.clients?.name}
                              </div>
                            </div>

                            {/* Time + Action */}
                            <div className="flex items-center gap-2">
                              {item.sent_to_partner_at && (
                                <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {formatDistanceToNow(new Date(item.sent_to_partner_at), {
                                      addSuffix: true,
                                      locale: fr
                                    })}
                                  </span>
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => handleReceive(item)}
                              >
                                <PackageCheck className="h-4 w-4" />
                                <span className="hidden sm:inline">Réceptionner</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Received Tab */}
          <TabsContent value="received">
            {!recentlyReceived || recentlyReceived.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Aucune réception récente</p>
                  <p className="text-sm">Les articles réceptionnés des 7 derniers jours apparaîtront ici</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="divide-y">
                    {recentlyReceived.map((item: PartnerLogisticsItem) => {
                      const daysAtPartner =
                        item.sent_to_partner_at && item.received_from_partner_at
                          ? differenceInDays(
                            new Date(item.received_from_partner_at),
                            new Date(item.sent_to_partner_at)
                          )
                          : null;

                      return (
                        <div key={item.id} className="py-3 flex items-center justify-between">
                            {/* Thumbnail */}
                            {(() => {
                              const article = item.order_articles;
                              const beforePhoto = article?.photos?.find(p => p.type === 'before')?.url;
                              
                              if (beforePhoto) {
                                const articleLabel = article ? `${getArticleTypeDisplayName(article.article_type, article.custom_article_type)}${article.brand ? ` (${article.brand})` : ''}` : 'Article';
                                return (
                                  <div 
                                    className="relative group w-12 h-12 rounded overflow-hidden cursor-pointer flex-shrink-0 border"
                                    onClick={() => setPreviewPhoto({
                                      url: beforePhoto,
                                      label: `Avant — ${articleLabel}`,
                                      filename: `photo-avant-${item.orders?.ticket_number}-${article.id}.jpg`
                                    })}
                                  >
                                    <img src={beforePhoto} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 border">
                                    <Camera className="h-4 w-4 text-muted-foreground/40" />
                                  </div>
                                );
                              }
                            })()}

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.service_name}</span>
                                <Badge className="bg-emerald-100 text-emerald-800">
                                  Réceptionné
                                </Badge>
                                {item.quality_rating && (
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: item.quality_rating }, (_, i) => (
                                      <span key={i} className="text-yellow-400">★</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            <div className="text-sm text-muted-foreground">
                              {item.orders?.ticket_number} • {item.orders?.clients?.name}
                              {" • "}
                              <span className="font-medium">{item.partners?.name}</span>
                              {daysAtPartner !== null && ` • ${daysAtPartner}j chez partenaire`}
                            </div>
                            {item.rating_notes && (
                              <p className="text-xs text-muted-foreground italic">
                                {item.rating_notes}
                              </p>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.received_from_partner_at && (
                              <span>
                                {formatDistanceToNow(new Date(item.received_from_partner_at), {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ReceiveItemDialog
        open={receiveDialogOpen}
        onClose={() => {
          setReceiveDialogOpen(false);
          setReceiveItem(null);
        }}
        item={receiveItem}
      />

      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-4xl bg-black/95 border-neutral-800 p-0 shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">Aperçu photo {previewPhoto?.label}</DialogTitle>
          <DialogDescription className="sr-only">Visionneuse photo plein écran pour la commande</DialogDescription>
          
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40 absolute top-0 left-0 right-0 z-10">
            <div className="text-white/90 text-sm font-medium px-2">
              {previewPhoto?.label}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={() => previewPhoto && handleDownloadPhoto(previewPhoto.url, previewPhoto.filename)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-9 w-9 p-0"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh] p-0 relative">
            {previewPhoto && (
              <img
                src={previewPhoto.url}
                alt="Preview"
                className="w-auto h-auto max-w-full max-h-[85vh] object-contain transition-all duration-300"
              />
            )}
            
            {/* Added a subtle vignette effect to make it look nicer */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"></div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
