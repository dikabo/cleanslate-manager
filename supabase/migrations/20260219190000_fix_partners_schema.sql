-- ============================================================
-- FIX: Add missing columns to partners table
-- The partners table was recreated without several columns
-- that the application code expects.
-- ============================================================

-- Add missing columns to partners table
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- The initial_schema used partner_specialty[] (array) and named the column
-- "partner_specialty", but the code expects a single enum column named "specialty".
-- Add the correct column if it doesn't exist.
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS specialty partner_specialty;
