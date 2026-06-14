-- Audit trail for cancelled orders (reason + user + date)

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  ticket_number TEXT,
  client_id UUID REFERENCES public.clients(id),
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  cancel_reason TEXT NOT NULL CHECK (char_length(trim(cancel_reason)) > 0),
  cancelled_by UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_id
  ON public.order_cancellations(order_id);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_cancelled_at
  ON public.order_cancellations(cancelled_at DESC);

ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Receptionists can view order cancellations" ON public.order_cancellations;
DROP POLICY IF EXISTS "Admins and Receptionists can create order cancellations" ON public.order_cancellations;

CREATE POLICY "Admins and Receptionists can view order cancellations"
ON public.order_cancellations
FOR SELECT
TO authenticated
USING (public.has_admin_or_receptionist_role());

CREATE POLICY "Admins and Receptionists can create order cancellations"
ON public.order_cancellations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_admin_or_receptionist_role()
  AND cancelled_by = auth.uid()
);
