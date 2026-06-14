-- Partial pickups support: track article-level pickups and keep order lifecycle coherent

ALTER TABLE public.order_articles
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_up_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS pickup_group_id UUID;

CREATE TABLE IF NOT EXISTS public.order_article_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.order_articles(id) ON DELETE CASCADE,
  pickup_group_id UUID NOT NULL,
  picked_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_by UUID REFERENCES public.profiles(id),
  article_amount NUMERIC NOT NULL DEFAULT 0,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_article_pickups_article_unique UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS idx_order_article_pickups_order_id
  ON public.order_article_pickups(order_id);

CREATE INDEX IF NOT EXISTS idx_order_article_pickups_group_id
  ON public.order_article_pickups(pickup_group_id);

CREATE OR REPLACE FUNCTION public.sync_order_status_from_article_pickups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_articles INT;
  current_status order_status;
BEGIN
  SELECT COUNT(*)
  INTO remaining_articles
  FROM public.order_articles
  WHERE order_id = NEW.order_id
    AND picked_up_at IS NULL;

  SELECT status
  INTO current_status
  FROM public.orders
  WHERE id = NEW.order_id;

  IF remaining_articles = 0 THEN
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = COALESCE(delivered_at, NOW()),
        updated_at = NOW()
    WHERE id = NEW.order_id;
  ELSIF current_status = 'delivered' THEN
    UPDATE public.orders
    SET status = 'ready',
        delivered_at = NULL,
        updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status_from_article_pickups ON public.order_articles;

CREATE TRIGGER trg_sync_order_status_from_article_pickups
AFTER UPDATE OF picked_up_at ON public.order_articles
FOR EACH ROW
WHEN (OLD.picked_up_at IS DISTINCT FROM NEW.picked_up_at)
EXECUTE FUNCTION public.sync_order_status_from_article_pickups();

ALTER TABLE public.order_article_pickups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_article_pickups'
      AND policyname = 'Enable read access for authenticated users on order_article_pickups'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users on order_article_pickups"
      ON public.order_article_pickups
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_article_pickups'
      AND policyname = 'Enable insert for authenticated users on order_article_pickups'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users on order_article_pickups"
      ON public.order_article_pickups
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_article_pickups'
      AND policyname = 'Enable update for authenticated users on order_article_pickups'
  ) THEN
    CREATE POLICY "Enable update for authenticated users on order_article_pickups"
      ON public.order_article_pickups
      FOR UPDATE
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_article_pickups'
      AND policyname = 'Enable delete for authenticated users on order_article_pickups'
  ) THEN
    CREATE POLICY "Enable delete for authenticated users on order_article_pickups"
      ON public.order_article_pickups
      FOR DELETE
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
