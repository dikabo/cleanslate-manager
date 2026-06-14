-- Charges management - schema only
-- Execute this first in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.expense_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
  subcategory TEXT NOT NULL,
  default_unit TEXT,
  default_unit_price NUMERIC,
  default_amount NUMERIC,
  default_quantity NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, category, subcategory)
);

CREATE TABLE IF NOT EXISTS public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID REFERENCES public.expense_catalog(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
  subcategory TEXT NOT NULL,
  allocation_scope TEXT NOT NULL DEFAULT 'period' CHECK (allocation_scope IN ('order', 'day', 'week', 'month', 'period')),
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  supplier TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expense_entries_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT expense_entries_quantity_non_negative CHECK (quantity IS NULL OR quantity >= 0),
  CONSTRAINT expense_entries_unit_price_non_negative CHECK (unit_price IS NULL OR unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_catalog_category
  ON public.expense_catalog(category, subcategory);

CREATE INDEX IF NOT EXISTS idx_expense_entries_expense_date
  ON public.expense_entries(expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expense_entries_category_date
  ON public.expense_entries(category, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expense_entries_order_id
  ON public.expense_entries(order_id);

CREATE OR REPLACE FUNCTION public.set_expense_entry_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_record public.expense_catalog%ROWTYPE;
BEGIN
  IF NEW.catalog_id IS NOT NULL THEN
    SELECT *
    INTO catalog_record
    FROM public.expense_catalog
    WHERE id = NEW.catalog_id;

    IF FOUND THEN
      NEW.designation := COALESCE(NULLIF(TRIM(NEW.designation), ''), catalog_record.name);
      NEW.category := COALESCE(NEW.category, catalog_record.category);
      NEW.subcategory := COALESCE(NULLIF(TRIM(NEW.subcategory), ''), catalog_record.subcategory);
      NEW.unit := COALESCE(NULLIF(TRIM(NEW.unit), ''), catalog_record.default_unit);
      NEW.quantity := COALESCE(NEW.quantity, catalog_record.default_quantity);
      NEW.unit_price := COALESCE(NEW.unit_price, catalog_record.default_unit_price);
      IF NEW.amount = 0 THEN
        NEW.amount := COALESCE(
          CASE
            WHEN NEW.quantity IS NOT NULL AND NEW.unit_price IS NOT NULL THEN NEW.quantity * NEW.unit_price
            ELSE NULL
          END,
          catalog_record.default_amount,
          0
        );
      END IF;
    END IF;
  END IF;

  IF NEW.amount = 0 AND NEW.quantity IS NOT NULL AND NEW.unit_price IS NOT NULL THEN
    NEW.amount := NEW.quantity * NEW.unit_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_expense_entry_defaults ON public.expense_entries;
CREATE TRIGGER trg_set_expense_entry_defaults
BEFORE INSERT OR UPDATE ON public.expense_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_expense_entry_defaults();

ALTER TABLE public.expense_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Receptionists can view expense catalog" ON public.expense_catalog;
DROP POLICY IF EXISTS "Admins and Receptionists can manage expense catalog" ON public.expense_catalog;
DROP POLICY IF EXISTS "Admins and Receptionists can update expense catalog" ON public.expense_catalog;
DROP POLICY IF EXISTS "Admins and Receptionists can delete expense catalog" ON public.expense_catalog;

CREATE POLICY "Admins and Receptionists can view expense catalog"
ON public.expense_catalog
FOR SELECT
TO authenticated
USING (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can manage expense catalog"
ON public.expense_catalog
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can update expense catalog"
ON public.expense_catalog
FOR UPDATE
TO authenticated
USING (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can delete expense catalog"
ON public.expense_catalog
FOR DELETE
TO authenticated
USING (public.has_admin_or_receptionist_role());

DROP POLICY IF EXISTS "Admins and Receptionists can view expense entries" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins and Receptionists can create expense entries" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins and Receptionists can update expense entries" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins and Receptionists can delete expense entries" ON public.expense_entries;

CREATE POLICY "Admins and Receptionists can view expense entries"
ON public.expense_entries
FOR SELECT
TO authenticated
USING (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can create expense entries"
ON public.expense_entries
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can update expense entries"
ON public.expense_entries
FOR UPDATE
TO authenticated
USING (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can delete expense entries"
ON public.expense_entries
FOR DELETE
TO authenticated
USING (public.has_admin_or_receptionist_role());
