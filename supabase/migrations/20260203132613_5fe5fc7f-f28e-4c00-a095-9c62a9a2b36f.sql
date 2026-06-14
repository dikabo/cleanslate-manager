-- ============================================
-- MIGRATION: Multi-Articles par Commande
-- ============================================

-- 1. Créer la table order_articles (articles individuels par commande)
CREATE TABLE public.order_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  article_type public.article_type NOT NULL,
  material public.material_type NOT NULL,
  brand TEXT,
  color TEXT,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 1, -- Ordre d'affichage
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Ajouter le lien article_id dans order_items
ALTER TABLE public.order_items 
ADD COLUMN article_id UUID REFERENCES public.order_articles(id) ON DELETE CASCADE;

-- 3. Migrer les données existantes: créer un article pour chaque commande existante
INSERT INTO public.order_articles (order_id, article_type, material, brand, color, position)
SELECT id, article_type, material, brand, color, 1
FROM public.orders
WHERE id IN (SELECT DISTINCT order_id FROM public.order_items);

-- 4. Mettre à jour order_items avec les nouveaux article_id
UPDATE public.order_items oi
SET article_id = oa.id
FROM public.order_articles oa
WHERE oi.order_id = oa.order_id;

-- 5. Migrer les photos vers les articles (ajouter article_id)
ALTER TABLE public.photos
ADD COLUMN article_id UUID REFERENCES public.order_articles(id) ON DELETE CASCADE;

-- Mettre à jour les photos existantes
UPDATE public.photos p
SET article_id = oa.id
FROM public.order_articles oa
WHERE p.order_id = oa.order_id;

-- 6. Trigger pour updated_at sur order_articles
CREATE TRIGGER update_order_articles_updated_at
  BEFORE UPDATE ON public.order_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Enable RLS sur order_articles
ALTER TABLE public.order_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order articles"
  ON public.order_articles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Index pour performance
CREATE INDEX idx_order_articles_order_id ON public.order_articles(order_id);
CREATE INDEX idx_order_items_article_id ON public.order_items(article_id);
CREATE INDEX idx_photos_article_id ON public.photos(article_id);