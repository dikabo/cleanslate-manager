-- Add invoice_url column to expense_entries
-- This stores the URL of the supplier invoice (image or PDF) uploaded to Supabase Storage

ALTER TABLE public.expense_entries
ADD COLUMN IF NOT EXISTS invoice_url TEXT;

COMMENT ON COLUMN public.expense_entries.invoice_url IS 'URL of the supplier invoice file (image or PDF) stored in Supabase Storage';
