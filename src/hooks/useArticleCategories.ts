import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArticleType, articleTypeLabels } from "@/types";

// ── Types ───────────────────────────────────────────────────
export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

// ── Slugify ─────────────────────────────────────────────────
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")    // non-alphanum → dash
    .replace(/^-+|-+$/g, "");       // trim leading/trailing dashes
}

// ── Display helper (used everywhere) ────────────────────────
/**
 * Returns the human-readable label for an article type.
 * - For predefined types (sneakers, boots, …) returns the French label.
 * - For `other` with a custom name returns the custom name.
 * - For `other` without a custom name returns "Autre".
 */
export function getArticleTypeDisplayName(
  articleType: ArticleType | string,
  customArticleType?: string | null
): string {
  if (articleType !== "other") {
    return (
      articleTypeLabels[articleType as ArticleType] ?? articleType
    );
  }
  return customArticleType?.trim() || "Autre";
}

// ── Hook: Fetch categories ──────────────────────────────────
export function useArticleCategories() {
  return useQuery({
    queryKey: ["article-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ArticleCategory[];
    },
  });
}

// ── Hook: Create category ───────────────────────────────────
export function useCreateArticleCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<ArticleCategory> => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Le nom de la catégorie est requis");

      const slug = slugify(trimmed);

      // Check if already exists (by slug)
      const { data: existing } = await supabase
        .from("article_categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (existing) return existing as ArticleCategory;

      // Insert new
      const { data, error } = await supabase
        .from("article_categories")
        .insert({ name: trimmed, slug })
        .select()
        .single();

      if (error) throw error;
      return data as ArticleCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article-categories"] });
    },
  });
}
