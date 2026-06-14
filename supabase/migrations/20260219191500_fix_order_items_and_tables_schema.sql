-- ============================================================
-- FIX: Align order_items table with application expectations
-- The initial_schema migration used "item_status" instead of
-- "status" and did not include "service_name".
-- ============================================================

-- 1. Rename item_status to status (if it exists under the old name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_items'
      AND column_name = 'item_status'
  ) THEN
    ALTER TABLE public.order_items RENAME COLUMN item_status TO status;
  END IF;
END $$;

-- 2. Add service_name column if missing
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS service_name TEXT;

-- 3. Backfill service_name from services table for existing rows
UPDATE public.order_items oi
SET service_name = s.name
FROM public.services s
WHERE oi.service_id = s.id
  AND oi.service_name IS NULL;

-- 4. Set a default for any remaining NULL service_name
UPDATE public.order_items
SET service_name = 'Service inconnu'
WHERE service_name IS NULL;

-- 5. Make service_name NOT NULL going forward
ALTER TABLE public.order_items
ALTER COLUMN service_name SET NOT NULL;

-- 6. Add other missing columns expected by the V2 schema
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS rating_notes TEXT,
ADD COLUMN IF NOT EXISTS sent_to_partner_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_from_partner_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Fix order_articles: rename material_type to material if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_articles'
      AND column_name = 'material_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_articles'
      AND column_name = 'material'
  ) THEN
    ALTER TABLE public.order_articles RENAME COLUMN material_type TO material;
  END IF;
END $$;

-- 8. Add missing columns to order_articles
ALTER TABLE public.order_articles
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 9. Add missing columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS article_type article_type NOT NULL DEFAULT 'sneakers',
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS material material_type NOT NULL DEFAULT 'leather',
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS diagnosis TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID,
ADD COLUMN IF NOT EXISTS estimated_date DATE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- 10. Add missing columns to photos table
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES public.order_articles(id),
ADD COLUMN IF NOT EXISTS annotations TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- 11. Add missing columns to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS preferences TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 12. Add missing columns to stock_items table
ALTER TABLE public.stock_items
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 13. Add missing columns to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 14. Fix services category column name if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'service_category'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.services RENAME COLUMN service_category TO category;
  END IF;
END $$;

-- 15. Fix stock_items category column name if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_items'
      AND column_name = 'stock_category'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_items'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.stock_items RENAME COLUMN stock_category TO category;
  END IF;
END $$;
