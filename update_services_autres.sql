-- Run manually in Supabase SQL Editor.
-- Adds "Autres" to every service category and removes the duplicate
-- "Agrandissement Elargissement" from the active Cordonnerie Femme catalog.

BEGIN;

-- Keep the cleaner existing label "Agrandissement / Élargissement".
-- Delete the duplicate only if no order item references it; otherwise hide it.
UPDATE public.services
SET is_active = false
WHERE id = '2e4483ae-f3a7-4b71-9df6-b4d24a73df01'
   OR (
    category = 'cordonnerie_femme'
    AND name = 'Agrandissement Elargissement'
  );

DELETE FROM public.services s
WHERE s.id = '2e4483ae-f3a7-4b71-9df6-b4d24a73df01'
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.service_id = s.id
  );

INSERT INTO public.services (
  id,
  name,
  category,
  base_price,
  is_custom_price,
  is_active
) VALUES
  ('95c62eee-ac0f-4e84-a243-2fbc1efe9001', 'Autres', 'cordonnerie_homme', 0, true, true),
  ('ff7e0308-cb75-43a5-a448-f78ee2d69b87', 'Autres', 'cordonnerie_femme', 0, true, true),
  ('d66f5cbb-f19c-45e2-bd85-4bd40d33ae49', 'Autres', 'sneakers', 0, true, true),
  ('e918714b-9f1a-4c0a-b632-7615e60a8fa3', 'Autres', 'maroquinerie', 0, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  is_custom_price = EXCLUDED.is_custom_price,
  is_active = true;

COMMIT;
