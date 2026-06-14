import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<AppRole, string> = {
    super_admin: "Super Admin",
    manager: "Manager",
    receptionist: "Réceptionniste",
    artisan: "Artisan",
    delivery: "Livreur",
    partner: "Partenaire",
};

interface UserProfile {
    id: string;
    user_id: string;
    full_name: string;
    email: string | null;
    roles: AppRole[];
}

interface EditUserRoleDialogProps {
    user: UserProfile | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditUserRoleDialog({
    user,
    isOpen,
    onOpenChange,
}: EditUserRoleDialogProps) {
    const queryClient = useQueryClient();
    const [newRole, setNewRole] = useState<AppRole>("receptionist");

    const addRole = useMutation({
        mutationFn: async () => {
            if (!user) return;
            const { error } = await supabase.from("user_roles").insert({
                user_id: user.user_id,
                role: newRole,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast.success("Rôle ajouté avec succès");
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    const removeRole = useMutation({
        mutationFn: async (role: AppRole) => {
            if (!user) return;
            const { error } = await supabase
                .from("user_roles")
                .delete()
                .eq("user_id", user.user_id)
                .eq("role", role);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast.success("Rôle supprimé");
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    if (!user) return null;

    const availableRoles = Object.keys(ROLE_LABELS).filter(
        (r) => !user.roles.includes(r as AppRole)
    ) as AppRole[];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Gérer les rôles</DialogTitle>
                    <DialogDescription>{user.full_name}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current roles */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Rôles actuels</Label>
                        {user.roles.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                Aucun rôle attribué
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {user.roles.map((role) => (
                                    <div
                                        key={role}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20"
                                    >
                                        {ROLE_LABELS[role]}
                                        <button
                                            type="button"
                                            onClick={() => removeRole.mutate(role)}
                                            className="ml-1 hover:text-destructive transition-colors"
                                            disabled={removeRole.isPending}
                                            title="Supprimer ce rôle"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add new role */}
                    {availableRoles.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-sm font-medium">Ajouter un rôle</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={newRole}
                                    onValueChange={(value) => setNewRole(value as AppRole)}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Sélectionner un rôle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoles.map((role) => (
                                            <SelectItem key={role} value={role}>
                                                {ROLE_LABELS[role]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => addRole.mutate()}
                                    disabled={addRole.isPending}
                                    size="sm"
                                >
                                    Ajouter
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
