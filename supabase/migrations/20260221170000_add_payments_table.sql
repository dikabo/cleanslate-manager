-- ============================================================
-- ADD: Payments table for tracking advance/balance collections
-- ============================================================

-- 1. Create payment enums
CREATE TYPE payment_type AS ENUM ('advance', 'balance', 'refund');
CREATE TYPE payment_method AS ENUM ('cash', 'mobile_money', 'card', 'transfer');

-- 2. Create payments table
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_type payment_type NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  collected_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (same pattern as other tables)
CREATE POLICY "Authenticated users can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (true);
