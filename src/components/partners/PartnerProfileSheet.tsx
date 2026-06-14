import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Partner, specialtyLabels, PartnerSpecialty, ArticleType } from "@/types";
import { getArticleTypeDisplayName } from "@/hooks/useArticleCategories";

// Shape of data fetched from order_item_partners with joined order_items and orders
interface PartnerTaskEntry {
    id: string;
    order_item_id: string;
    partner_id: string;
    task_description: string;
    partner_cost: number | null;
    status: string | null;
    sent_at: string | null;
    received_at: string | null;
    created_at: string;
    order_items: {
        id: string;
        service_name: string;
        price: number;
        status: string;
        article_id: string | null;
        quality_rating: number | null;
        rating_notes: string | null;
        is_partner_paid: boolean | null;
        orders: {
            ticket_number: string;
            article_type?: ArticleType;
            custom_article_type?: string | null;
            brand?: string;
            clients: { name: string } | null;
            photos?: Array<{ url: string; type: string; article_id: string | null }>;
        };
    };
}

import { formatPrice } from "@/hooks/useServices";
import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Building, Star, Phone, Mail, MapPin, Users, Package, History, CheckCircle, Edit, Trash2, Wallet } from "lucide-react";
import { CreatePartnerDialog } from "./CreatePartnerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PartnerProfileSheetProps {
    partner: Partner | null;
    open: boolean;
    onClose: () => void;
}

export function PartnerProfileSheet({ partner, open, onClose }: PartnerProfileSheetProps) {
    const { isAdminOrManager } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Fetch tasks assigned to this partner via order_item_partners
    const { data: partnerTasks = [], isLoading } = useQuery({
        queryKey: ['partner-items', partner?.id],
        queryFn: async () => {
            if (!partner) return [];

            const { data, error } = await supabase
                .from('order_item_partners')
                .select(`
                    *,
                    order_items (
                        id,
                        service_name,
                        price,
                        status,
                        article_id,
                        quality_rating,
                        rating_notes,
                        is_partner_paid,
                        orders (
                            ticket_number,
                            article_type,
                            custom_article_type,
                            brand,
                            clients (name),
                            photos (url, type, article_id)
                        )
                    )
                `)
                .eq('partner_id', partner.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as PartnerTaskEntry[];
        },
        enabled: !!partner
    });

    const togglePaymentStatus = useMutation({
        mutationFn: async ({ id, isPaid }: { id: string, isPaid: boolean }) => {
            const { error } = await supabase
                .from('order_items')
                .update({ is_partner_paid: isPaid })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-items', partner?.id] });
            toast({ title: "Statut mis à jour", description: "Le paiement a été confirmé avec succès." });
        },
        onError: (error) => {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    });

    const deletePartner = useMutation({
        mutationFn: async () => {
            if (!partner) return;
            const { error } = await supabase
                .from('partners')
                .update({ is_active: false })
                .eq('id', partner.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partners'] });
            toast({ title: "Partenaire supprimé", description: "Le partenaire a été retiré de la liste." });
            setDeleteDialogOpen(false);
            onClose();
        },
        onError: (error) => {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    });

    const displaySpecialties = partner?.specialties && partner.specialties.length > 0
        ? partner.specialties
        : partner?.specialty ? [partner.specialty] : [];

    // Active = assigned or sent (not yet received/completed)
    const activeTasks = partnerTasks.filter(t =>
        t.status === 'assigned' || t.status === 'sent'
    );

    // History = received or completed
    const historyTasks = partnerTasks.filter(t =>
        t.status === 'received' || t.status === 'completed'
    );

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star
                key={i}
                className={`h-4 w-4 ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            />
        ));
    };

    return (
        <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto hidden-scrollbar">
                {partner && (
                    <>
                        <SheetHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <SheetTitle className="font-display text-2xl flex items-center gap-2">
                                        <Building className="h-6 w-6 text-primary" />
                                        {partner.name}
                                    </SheetTitle>
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {displaySpecialties.map((spec) => (
                                            <Badge key={spec} variant="secondary">
                                                {specialtyLabels[spec as PartnerSpecialty] || spec}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                    <div className="flex flex-col items-end gap-1 bg-muted/50 p-2 rounded-lg">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note globale</span>
                                        <div className="flex items-center gap-1">
                                            {renderStars(partner.average_rating || 0)}
                                        </div>
                                    </div>

                                    {isAdminOrManager && (
                                        <div className="flex items-center gap-2">
                                            <CreatePartnerDialog
                                                partner={partner}
                                                trigger={
                                                    <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground" title="Modifier le partenaire">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                }
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setDeleteDialogOpen(true)}
                                                title="Supprimer le partenaire"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SheetHeader>

                        <Tabs defaultValue="info" className="mt-2">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="info">Informations</TabsTrigger>
                                <TabsTrigger value="active" className="flex items-center gap-2">
                                    En cours
                                    {activeTasks.length > 0 && (
                                        <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                                            {activeTasks.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="history">Historique</TabsTrigger>
                            </TabsList>

                            {/* Tab: Informations */}
                            <TabsContent value="info" className="space-y-6 mt-4">
                                <div className="bg-card border rounded-lg p-5 space-y-4 shadow-sm">
                                    <h3 className="font-semibold px-1 border-b pb-2">Coordonnées</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {partner.contact_name && (
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <Users className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Contact</p>
                                                    <p className="font-medium text-sm">{partner.contact_name}</p>
                                                </div>
                                            </div>
                                        )}
                                        {partner.phone && (
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <Phone className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Téléphone</p>
                                                    <p className="font-medium text-sm">{partner.phone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {partner.email && (
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <Mail className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="truncate pr-4">
                                                    <p className="text-xs text-muted-foreground">Email</p>
                                                    <p className="font-medium text-sm truncate">{partner.email}</p>
                                                </div>
                                            </div>
                                        )}
                                        {partner.city && (
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <MapPin className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Ville</p>
                                                    <p className="font-medium text-sm">{partner.city}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {partner.address && (
                                        <div className="mt-4 pt-4 border-t">
                                            <p className="text-xs text-muted-foreground mb-1">Adresse complète</p>
                                            <p className="text-sm">{partner.address}</p>
                                        </div>
                                    )}
                                </div>

                                {partner.notes && (
                                    <div className="bg-muted/30 border rounded-lg p-5">
                                        <h3 className="font-semibold mb-2 text-sm">Notes internes</h3>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{partner.notes}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-muted/50 border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                        <span className="text-3xl font-display font-bold text-primary mb-1">{partner.total_orders || 0}</span>
                                        <span className="text-xs text-muted-foreground">Commandes confiées</span>
                                    </div>
                                    <div className="bg-muted/50 border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                        <span className="text-3xl font-display font-bold text-amber-500 mb-1">
                                            {partner.average_rating ? partner.average_rating.toFixed(1) : '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">Note moyenne</span>
                                    </div>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                        <span className="text-3xl font-display font-bold text-orange-600 mb-1">{partner.active_items_count || 0}</span>
                                        <span className="text-xs text-orange-700">En cours</span>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab: En cours */}
                            <TabsContent value="active" className="space-y-4 mt-4">
                                {isLoading ? (
                                    <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                                ) : activeTasks.length === 0 ? (
                                    <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed">
                                        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                        <p className="text-muted-foreground">Aucun travail actuellement chez ce partenaire.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeTasks.map(task => (
                                            <div key={task.id} className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-primary">{task.order_items.orders.ticket_number}</span>
                                                        <Badge variant="outline" className="text-[10px] py-0">{task.status === 'sent' ? 'Envoyé' : 'Assigné'}</Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {task.sent_at ? format(new Date(task.sent_at), 'dd MMM yyyy', { locale: fr }) : task.created_at ? format(new Date(task.created_at), 'dd MMM yyyy', { locale: fr }) : ''}
                                                    </span>
                                                </div>
                                                <div className="flex gap-3 mt-2">
                                                    {(() => {
                                                        const photoUrl = task.order_items.orders.photos?.find(p => p.type === 'before' && (!p.article_id || p.article_id === task.order_items.article_id))?.url;
                                                        if (photoUrl) {
                                                            return (
                                                                <div className="flex-shrink-0">
                                                                    <img src={photoUrl} alt="Article" className="w-16 h-16 object-cover rounded-md border" />
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div className="flex-1">
                                                        <p className="font-semibold">{task.order_items.service_name}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5 italic">Tâche : {task.task_description}</p>
                                                        <div className="text-xs text-muted-foreground mt-1 flex gap-2 flex-wrap items-center">
                                                            {task.order_items.orders.article_type && (
                                                                <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                                                                    {getArticleTypeDisplayName(task.order_items.orders.article_type, task.order_items.orders.custom_article_type)}
                                                                </Badge>
                                                            )}
                                                            {task.order_items.orders.brand && (
                                                                <span className="font-medium">{task.order_items.orders.brand}</span>
                                                            )}
                                                            <span>Client: {task.order_items.orders.clients?.name}</span>
                                                        </div>

                                                        {task.partner_cost != null && task.partner_cost > 0 && (
                                                            <div className="mt-3 pt-2 border-t flex justify-between items-center text-xs">
                                                                <span className="text-muted-foreground">Coût estimé:</span>
                                                                <span className="font-medium">{formatPrice(task.partner_cost)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Tab: Historique */}
                            <TabsContent value="history" className="space-y-4 mt-4">
                                {isLoading ? (
                                    <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                                ) : historyTasks.length === 0 ? (
                                    <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed">
                                        <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                        <p className="text-muted-foreground">Aucun historique disponible pour ce partenaire.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {historyTasks.map(task => (
                                            <div key={task.id} className="border rounded-lg p-3 bg-card">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{task.order_items.orders.ticket_number}</span>
                                                        <Badge variant="outline" className="text-[10px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Terminé
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {task.received_at ? format(new Date(task.received_at), 'dd MMM yyyy', { locale: fr }) : ''}
                                                    </span>
                                                </div>

                                                <div className="flex gap-3 mt-2">
                                                    {(() => {
                                                        const photoUrl = task.order_items.orders.photos?.find(p => p.type === 'before' && (!p.article_id || p.article_id === task.order_items.article_id))?.url;
                                                        if (photoUrl) {
                                                            return (
                                                                <div className="flex-shrink-0">
                                                                    <img src={photoUrl} alt="Article" className="w-16 h-16 object-cover rounded-md border" />
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold">{task.order_items.service_name}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5 italic">Tâche : {task.task_description}</p>

                                                        <div className="mt-2 text-xs text-muted-foreground flex gap-2 flex-wrap items-center">
                                                            {task.order_items.orders.article_type && (
                                                                <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                                                                    {getArticleTypeDisplayName(task.order_items.orders.article_type, task.order_items.orders.custom_article_type)}
                                                                </Badge>
                                                            )}
                                                            {task.order_items.orders.brand && (
                                                                <span className="font-medium">{task.order_items.orders.brand}</span>
                                                            )}
                                                            <span>Client: {task.order_items.orders.clients?.name}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 bg-muted/50 p-3 rounded text-sm space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground text-xs">Montant prestation:</span>
                                                        <span className="font-bold text-primary">
                                                            {task.partner_cost ? formatPrice(task.partner_cost) : '-'}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                                        <Label className="text-xs flex items-center gap-1.5 font-medium cursor-pointer" htmlFor={`pay-${task.order_items.id}`}>
                                                            {task.order_items.is_partner_paid ? (
                                                                <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Payé</span>
                                                            ) : (
                                                                <span className="text-amber-600 flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> À payer</span>
                                                            )}
                                                        </Label>
                                                        {isAdminOrManager && (
                                                            <Switch
                                                                id={`pay-${task.order_items.id}`}
                                                                checked={task.order_items.is_partner_paid || false}
                                                                onCheckedChange={(checked) => togglePaymentStatus.mutate({ id: task.order_items.id, isPaid: checked })}
                                                                disabled={togglePaymentStatus.isPending || (task.partner_cost === undefined || task.partner_cost === null || task.partner_cost <= 0)}
                                                            />
                                                        )}
                                                    </div>

                                                    {(task.order_items.quality_rating || task.order_items.rating_notes) && (
                                                        <div className="pt-2 border-t border-border/50 space-y-1">
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-muted-foreground">Note qualité:</span>
                                                                <div className="flex">{renderStars(task.order_items.quality_rating || 0)}</div>
                                                            </div>
                                                            {task.order_items.rating_notes && (
                                                                <p className="italic text-muted-foreground text-[10px] mt-1 pt-1 border-t border-border/50">
                                                                    "{task.order_items.rating_notes}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </SheetContent>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le partenaire ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer {partner?.name} ? Cette action masquera le partenaire de la liste active, mais conservera son historique pour les commandes passées.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                deletePartner.mutate();
                            }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={deletePartner.isPending}
                        >
                            {deletePartner.isPending ? "Suppression..." : "Supprimer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    );
}
