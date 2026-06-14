import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Client } from "@/types";

interface CreateClientDialogProps {
    trigger?: React.ReactNode;
    client?: Client;
    onSuccess?: (client: Client) => void;
}

export function CreateClientDialog({ trigger, client, onSuccess }: CreateClientDialogProps) {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [preferences, setPreferences] = useState("");

    const resetForm = () => {
        setName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setPreferences("");
    };

    useEffect(() => {
        if (!isOpen) return;

        if (client) {
            setName(client.name);
            setPhone(client.phone);
            setEmail(client.email || "");
            setAddress(client.address || "");
            setPreferences(client.preferences || "");
            return;
        }

        resetForm();
    }, [client, isOpen]);

    const saveClient = useMutation({
        mutationFn: async () => {
            const payload = {
                name,
                phone,
                email: email || null,
                address: address || null,
                preferences: preferences || null,
            };

            if (client) {
                const { data, error } = await supabase
                    .from("clients")
                    .update(payload)
                    .eq("id", client.id)
                    .select()
                    .single();

                if (error) throw error;
                return data as Client;
            }

            const { data, error } = await supabase
                .from("clients")
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return data as Client;
        },
        onSuccess: (savedClient) => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            onSuccess?.(savedClient);
            toast.success(client ? "Client modifie avec succes" : "Client cree avec succes");
            if (!client) {
                resetForm();
            }
            setIsOpen(false);
        },
        onError: (error) => {
            toast.error(`Erreur: ${error.message}`);
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="touch-target">
                        <Plus className="h-5 w-5 mr-2" />
                        Nouveau Client
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{client ? "Modifier le client" : "Nouveau Client"}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveClient.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nom *</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nom complet"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Telephone *</Label>
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+237 6XX XXX XXX"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="client@email.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Adresse complete"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Preferences / Notes</Label>
                        <Input
                            value={preferences}
                            onChange={(e) => setPreferences(e.target.value)}
                            placeholder="Notes internes, preferences..."
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={!name || !phone || saveClient.isPending}
                    >
                        {saveClient.isPending
                            ? "Enregistrement..."
                            : client
                                ? "Mettre a jour"
                                : "Creer le client"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
