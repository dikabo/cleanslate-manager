import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { PartnerSpecialty, specialtyLabels, Partner } from "@/types";
import { cn } from "@/lib/utils";

interface CreatePartnerDialogProps {
  trigger?: React.ReactNode;
  partner?: Partner;
}

export function CreatePartnerDialog({ trigger, partner }: CreatePartnerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setSelectedSpecialties([]);
    setCustomSpecialty("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setContactName("");
    setNotes("");
  };

  useEffect(() => {
    if (isOpen) {
      if (partner) {
        setName(partner.name);
        setSelectedSpecialties(partner.specialties && partner.specialties.length > 0 ? partner.specialties : [partner.specialty]);
        setCustomSpecialty("");
        setPhone(partner.phone || "");
        setEmail(partner.email || "");
        setAddress(partner.address || "");
        setCity(partner.city || "");
        setContactName(partner.contact_name || "");
        setNotes(partner.notes || "");
      } else {
        resetForm();
      }
    }
  }, [isOpen, partner]);

  const toggleSpecialty = (key: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(key)
        ? prev.filter(s => s !== key)
        : [...prev, key]
    );
  };

  const addCustomSpecialty = () => {
    if (customSpecialty.trim() && !selectedSpecialties.includes(customSpecialty.trim())) {
      setSelectedSpecialties(prev => [...prev, customSpecialty.trim()]);
      setCustomSpecialty("");
    }
  };

  const createPartner = useMutation({
    mutationFn: async () => {
      // For backward compatibility, we use the first specialty as the main one if available
      const mainSpecialty = selectedSpecialties.find(s =>
        Object.keys(specialtyLabels).includes(s)
      ) as PartnerSpecialty || 'nettoyage';

      const payload = {
        name,
        specialty: mainSpecialty,
        specialties: selectedSpecialties,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        contact_name: contactName || null,
        notes: notes || null
      };

      if (partner) {
        const { error } = await supabase.from('partners').update(payload).eq('id', partner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('partners').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast({
        title: partner ? "Partenaire modifié" : "Partenaire créé",
        description: partner ? "Le partenaire a été mis à jour avec succès." : "Le partenaire a été ajouté avec succès."
      });
      if (!partner) resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="touch-target">
            <Plus className="h-5 w-5 mr-2" />
            Nouveau Partenaire
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{partner ? "Modifier le partenaire" : "Ajouter un partenaire"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPartner.mutate();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Atelier Cuir & Co"
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Métiers / Spécialités *</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(Object.entries(specialtyLabels) as [PartnerSpecialty, string][]).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={selectedSpecialties.includes(key) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3",
                      !selectedSpecialties.includes(key) && "text-muted-foreground"
                    )}
                    onClick={() => toggleSpecialty(key)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  placeholder="Ajouter un autre métier..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSpecialty();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCustomSpecialty}
                  disabled={!customSpecialty.trim()}
                >
                  Ajouter
                </Button>
              </div>

              {selectedSpecialties.filter(s => !Object.keys(specialtyLabels).includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSpecialties
                    .filter(s => !Object.keys(specialtyLabels).includes(s))
                    .map(s => (
                      <Badge key={s} variant="secondary" className="gap-1 pr-1">
                        {s}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => toggleSpecialty(s)}
                        />
                      </Badge>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 07..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@partenaire.ci"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Quartier, Rue..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Abidjan"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact">Personne de contact</Label>
            <Input
              id="contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nom du responsable"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tarifs, délais habituels..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={!name || selectedSpecialties.length === 0 || createPartner.isPending}
          >
            {createPartner.isPending ? "Enregistrement..." : (partner ? "Mettre à jour" : "Créer le partenaire")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

