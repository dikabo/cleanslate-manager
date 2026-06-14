-- 1. CORRIGER LES POLITIQUES DE LA TABLE PHOTOS (Base de données)
DROP POLICY IF EXISTS "Authenticated users can create photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated users can view photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON public.photos;

CREATE POLICY "Authenticated users can manage photos"
ON public.photos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. CORRIGER LES POLITIQUES DU BUCKET (Stockage des images)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-photos', 'order-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-photos');

DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-photos');

DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-photos');

DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-photos');
