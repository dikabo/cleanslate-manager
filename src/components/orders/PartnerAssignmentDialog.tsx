import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatPrice } from "@/hooks/useServices";
import { specialtyLabels, itemStatusLabels, OrderItem, Partner, PartnerSpecialty } from "@/types";
import { Building, Star, Home, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartnerAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  orderItem: OrderItem | null;
}

interface Assignment {
  id?: string;
  partner_id: string;
  task_description: string;
  partner_cost: number;
}

export function PartnerAssignmentDialog({
  open,
  onClose,
  orderItem,
}: PartnerAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const [assignType, setAssignType] = useState<"internal" | "partner">("internal");
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Initialize state when orderItem changes
  useEffect(() => {
    if (orderItem) {
      const isInternal = orderItem.is_internal;

      let initialAssignments: Assignment[] = [];
      if (orderItem.order_item_partners && orderItem.order_item_partners.length > 0) {
        initialAssignments = orderItem.order_item_partners.map(p => ({
          id: p.id,
          partner_id: p.partner_id,
          task_description: p.task_description,
          partner_cost: p.partner_cost || 0,
        }));
      } else if (orderItem.assigned_to_partner_id) {
        // Legacy fallback
        initialAssignments = [{
          partner_id: orderItem.assigned_to_partner_id,
          task_description: "Service complet",
          partner_cost: orderItem.partner_cost || 0,
        }];
      }

      setAssignments(initialAssignments);
      setAssignType(isInternal && initialAssignments.length === 0 ? "internal" : "partner");

      // If partner is selected but no assignments exist, add an empty one
      if (!isInternal && initialAssignments.length === 0) {
        setAssignType("partner");
        setAssignments([{ partner_id: "", task_description: "", partner_cost: 0 }]);
      }
    }
  }, [orderItem, open]);

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Partner[];
    },
  });

  const handleAddAssignment = () => {
    setAssignments([...assignments, { partner_id: "", task_description: "", partner_cost: 0 }]);
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (index: number, field: keyof Assignment, value: any) => {
    const newAssignments = [...assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setAssignments(newAssignments);
  };

  // Update assignment mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!orderItem) return;

      const isInternal = assignType === "internal" || assignments.length === 0;

      // Ensure all assignments have partner_id and task_description if partner mode
      if (!isInternal) {
        for (const a of assignments) {
          if (!a.partner_id || !a.task_description.trim()) {
            throw new Error("Veuillez remplir tous les champs (partenaire et tâche) pour chaque assignation.");
          }
        }
      }

      // Update order_items
      const defaultPartnerId = !isInternal && assignments.length > 0 ? assignments[0].partner_id : null;
      const totalPartnerCost = !isInternal ? assignments.reduce((sum, a) => sum + (a.partner_cost || 0), 0) : null;

      const updateData: Record<string, unknown> = {
        is_internal: isInternal,
        assigned_to_partner_id: defaultPartnerId, // Legacy
        partner_cost: totalPartnerCost, // Legacy
      };

      if (!isInternal) {
        updateData.status = "sent_to_partner";
        updateData.sent_to_partner_at = new Date().toISOString();
      } else if (isInternal) {
        updateData.status = "in_progress";
      }

      const { error: updateError } = await supabase
        .from("order_items")
        .update(updateData)
        .eq("id", orderItem.id);

      if (updateError) throw updateError;

      // Handle order_item_partners

      // First, get currently stored assignments
      const { data: currentPartners, error: fetchError } = await supabase
        .from("order_item_partners")
        .select("id")
        .eq("order_item_id", orderItem.id);

      if (fetchError) throw fetchError;

      const currentIds = currentPartners?.map(p => p.id) || [];
      const newIds = assignments.filter(a => a.id).map(a => a.id);

      // Delete removed assignments
      const idsToDelete = currentIds.filter(id => !newIds.includes(id));
      if (idsToDelete.length > 0) {
        await supabase
          .from("order_item_partners")
          .delete()
          .in("id", idsToDelete);
      }

      // If internal, we are done
      if (isInternal) return;

      // Insert or update assignments
      for (const a of assignments) {
        if (a.id) {
          // Update
          await supabase
            .from("order_item_partners")
            .update({
              partner_id: a.partner_id,
              task_description: a.task_description,
              partner_cost: a.partner_cost
            })
            .eq("id", a.id);
        } else {
          // Insert
          await supabase
            .from("order_item_partners")
            .insert({
              order_item_id: orderItem.id,
              partner_id: a.partner_id,
              task_description: a.task_description,
              partner_cost: a.partner_cost,
              status: "assigned"
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      queryClient.invalidateQueries({ queryKey: ["partner-items"] });
      toast.success("Attribution mise à jour");
      onClose();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  if (!orderItem) return null;

  const totalCost = assignments.reduce((sum, a) => sum + (a.partner_cost || 0), 0);
  const isValidPartnerState = assignType === "internal" || (assignments.length > 0 && assignments.every(a => a.partner_id && a.task_description.trim()));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto hidden-scrollbar">
        <DialogHeader>
          <DialogTitle>Attribution du service</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="font-medium">{orderItem.service_name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Prix client: <span className="font-semibold text-foreground">{formatPrice(orderItem.price)}</span>
            </p>
            <Badge variant="outline" className="mt-2">
              {itemStatusLabels[orderItem.status]}
            </Badge>
          </div>

          {/* Assignment Type */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAssignType("internal")}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                assignType === "internal"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Home className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">Interne</p>
              <p className="text-sm text-muted-foreground">
                Traité à l'atelier
              </p>
            </button>
            <button
              onClick={() => {
                setAssignType("partner");
                if (assignments.length === 0) handleAddAssignment();
              }}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                assignType === "partner"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Building className="h-5 w-5 text-orange-500 mb-2" />
              <p className="font-medium">Partenaire(s)</p>
              <p className="text-sm text-muted-foreground">
                Envoyé à des prestataires
              </p>
            </button>
          </div>

          {/* Partner Selection */}
          {assignType === "partner" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Partenaires assignés</Label>
                <Button size="sm" variant="outline" onClick={handleAddAssignment} className="h-8">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>

              {assignments.map((assignment, index) => (
                <div key={index} className="p-4 border rounded-lg bg-card space-y-4 relative">
                  {assignments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveAssignment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="space-y-2 pr-6">
                    <Label>Partenaire</Label>
                    <Select value={assignment.partner_id} onValueChange={(val) => updateAssignment(index, "partner_id", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un partenaire..." />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((partner) => (
                          <SelectItem key={partner.id} value={partner.id}>
                            <div className="flex items-center gap-2">
                              <span>{partner.name}</span>
                              <div className="flex gap-1 overflow-hidden max-w-[150px]">
                                {(partner.specialties || [partner.specialty]).slice(0, 1).map(s => (
                                  <Badge key={s} variant="outline" className="text-[10px] py-0 px-1 whitespace-nowrap">
                                    {specialtyLabels[s as PartnerSpecialty] || s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tâche à effectuer</Label>
                      <Input
                        value={assignment.task_description}
                        onChange={(e) => updateAssignment(index, "task_description", e.target.value)}
                        placeholder="Ex: Patin, Entretien..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Coût estimé</Label>
                      <Input
                        type="number"
                        value={assignment.partner_cost || ""}
                        onChange={(e) => updateAssignment(index, "partner_cost", parseInt(e.target.value) || 0)}
                        placeholder="Montant payé"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {assignments.length > 0 && totalCost > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span>Prix client</span>
                    <span className="font-medium">{formatPrice(orderItem.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span>Coût total partenaires</span>
                    <span className="font-medium text-orange-600">-{formatPrice(totalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
                    <span className="font-semibold">Marge bénéficiaire</span>
                    <span className={cn(
                      "font-bold",
                      orderItem.price - totalCost >= 0 ? "text-emerald-600" : "text-destructive"
                    )}>
                      {formatPrice(orderItem.price - totalCost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || (assignType === "partner" && !isValidPartnerState)}
            className="flex-1"
          >
            {updateMutation.isPending ? "Mise à jour..." : "Confirmer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
