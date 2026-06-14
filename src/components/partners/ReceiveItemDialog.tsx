import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPrice } from "@/hooks/useServices";
import { Star, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiveItemDialogProps {
    open: boolean;
    onClose: () => void;
    item: {
        id: string;
        service_name: string;
        price: number;
        partner_cost?: number;
        sent_to_partner_at?: string;
        orders?: {
            ticket_number: string;
            clients?: { name: string };
        };
        partners?: {
            name: string;
        };
    } | null;
}

export function ReceiveItemDialog({ open, onClose, item }: ReceiveItemDialogProps) {
    const queryClient = useQueryClient();
    const [qualityRating, setQualityRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [ratingNotes, setRatingNotes] = useState("");
    const [receivedDate, setReceivedDate] = useState<string>("");

    const receiveMutation = useMutation({
        mutationFn: async () => {
            if (!item) return;

            const { error } = await supabase
                .from("order_items")
                .update({
                    status: "received_from_partner",
                    received_from_partner_at: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
                    quality_rating: qualityRating > 0 ? qualityRating : null,
                    rating_notes: ratingNotes || null,
                })
                .eq("id", item.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["items-at-partners"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["partner-performance"] });
            toast.success("Article réceptionné avec succès");
            handleClose();
        },
        onError: (error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    const handleClose = () => {
        setQualityRating(0);
        setHoverRating(0);
        setRatingNotes("");
        setReceivedDate("");
        onClose();
    };

    if (!item) return null;

    const daysAtPartner = item.sent_to_partner_at
        ? Math.ceil(
            (Date.now() - new Date(item.sent_to_partner_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        : null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-emerald-600" />
                        Réception article
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Item Summary */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="font-medium">{item.service_name}</p>
                            <Badge variant="outline">{item.orders?.ticket_number}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Client: {item.orders?.clients?.name || "—"}
                        </p>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                Partenaire: <span className="font-medium text-foreground">{item.partners?.name || "—"}</span>
                            </span>
                            {daysAtPartner !== null && (
                                <Badge
                                    className={cn(
                                        daysAtPartner > 7
                                            ? "bg-red-100 text-red-800"
                                            : daysAtPartner > 3
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-emerald-100 text-emerald-800"
                                    )}
                                >
                                    {daysAtPartner} jour{daysAtPartner > 1 ? "s" : ""}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Date de réception</Label>
                        <Input
                            type="datetime-local"
                            value={receivedDate}
                            onChange={(e) => setReceivedDate(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                            Laissez vide pour utiliser l'heure actuelle.
                        </p>
                    </div>

                    {/* Quality Rating */}
                    <div className="space-y-2">
                        <Label>Qualité du travail</Label>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setQualityRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="p-1 transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={cn(
                                            "h-7 w-7 transition-colors",
                                            (hoverRating || qualityRating) >= star
                                                ? "text-yellow-400 fill-yellow-400"
                                                : "text-muted-foreground/30"
                                        )}
                                    />
                                </button>
                            ))}
                            {qualityRating > 0 && (
                                <span className="text-sm text-muted-foreground ml-2">
                                    {qualityRating}/5
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Observations</Label>
                        <Textarea
                            value={ratingNotes}
                            onChange={(e) => setRatingNotes(e.target.value)}
                            placeholder="Notes sur la qualité, état de l'article, remarques..."
                            rows={3}
                        />
                    </div>

                    {/* Cost summary */}
                    {item.partner_cost && item.partner_cost > 0 && (
                        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Prix client</span>
                                <span className="font-medium">{formatPrice(item.price)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Coût partenaire</span>
                                <span className="font-medium text-orange-600">
                                    -{formatPrice(item.partner_cost)}
                                </span>
                            </div>
                            <div className="flex justify-between pt-1 border-t">
                                <span className="font-semibold">Marge</span>
                                <span
                                    className={cn(
                                        "font-bold",
                                        item.price - item.partner_cost > 0
                                            ? "text-emerald-600"
                                            : "text-destructive"
                                    )}
                                >
                                    {formatPrice(item.price - item.partner_cost)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                        Annuler
                    </Button>
                    <Button
                        onClick={() => receiveMutation.mutate()}
                        disabled={receiveMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                        {receiveMutation.isPending ? "Réception..." : "Confirmer la réception"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
