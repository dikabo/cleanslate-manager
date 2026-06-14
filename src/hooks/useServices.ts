import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ServiceCategory } from "@/types";

export interface DbService {
  id: string;
  name: string;
  category: ServiceCategory;
  base_price: number;
  is_custom_price: boolean;
  is_active: boolean;
  created_at: string;
}

export const serviceCategories: Record<ServiceCategory, string> = {
  cordonnerie_homme: "Cordonnerie Homme",
  cordonnerie_femme: "Cordonnerie Femme",
  sneakers: "Sneakers",
  maroquinerie: "Maroquinerie",
};

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as DbService[];
    },
  });
}

export function getServicesByCategoryFromList(services: DbService[], category: string): DbService[] {
  return services.filter((s) => s.category === category);
}

export function isOtherService(service: Pick<DbService, "name">): boolean {
  return service.name.trim().toLowerCase() === "autres";
}

export function getServiceDisplayName(
  service: Pick<DbService, "name">,
  customName?: string
): string {
  return isOtherService(service) && customName?.trim()
    ? customName.trim()
    : service.name;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR").format(price) + " FCFA";
}
