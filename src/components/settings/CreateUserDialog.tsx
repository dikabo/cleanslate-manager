import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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

export function CreateUserDialog() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState<AppRole>("receptionist");

    const resetForm = () => {
        setFullName("");
        setEmail("");
        setPassword("");
        setPhone("");
        setRole("receptionist");
    };

    const createUser = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke("create-user", {
                body: {
                    email,
                    password,
                    fullName,
                    phone,
                    role,
                },
            });

            if (error) {
                console.error("Error from Edge Function:", error);
                throw new Error(error.message || "Erreur lors de la création de l'utilisateur");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast.success("Utilisateur créé avec succès", {
                description: "Un email de confirmation a été envoyé.",
            });
            resetForm();
            setIsOpen(false);
        },
        onError: (error: Error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="touch-target">
                    <UserPlus className="h-5 w-5 mr-2" />
                    Nouvel Utilisateur
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Créer un Utilisateur</DialogTitle>
                    <DialogDescription>
                        L'utilisateur recevra un email de confirmation pour activer son
                        compte.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createUser.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="create-fullname">Nom complet *</Label>
                        <Input
                            id="create-fullname"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Jean Dupont"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="create-email">Email *</Label>
                        <Input
                            id="create-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="utilisateur@email.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="create-password">Mot de passe *</Label>
                        <Input
                            id="create-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 caractères"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="create-phone">Téléphone</Label>
                        <Input
                            id="create-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+237 6XX XXX XXX"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="create-role">Rôle *</Label>
                        <Select
                            value={role}
                            onValueChange={(value) => setRole(value as AppRole)}
                        >
                            <SelectTrigger id="create-role">
                                <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={
                            !fullName || !email || !password || createUser.isPending
                        }
                    >
                        {createUser.isPending ? "Création..." : "Créer l'utilisateur"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
