-- Add specialties column as a text array
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';

-- Migrate existing specialty enum values to the new specialties array
UPDATE public.partners 
SET specialties = ARRAY[specialty::TEXT] 
WHERE specialty IS NOT NULL AND (specialties IS NULL OR specialties = '{}');

-- Notify user that we are using text array for more flexibility
COMMENT ON COLUMN public.partners.specialties IS 'Array of specialties, allows multiple values and custom text.';
