-- ============================================================
-- SEED: Insert default services catalog
-- The services table was created but never populated.
-- This migration adds a realistic catalog of services for
-- all four categories expected by the application.
-- ============================================================

-- Cordonnerie Homme
INSERT INTO public.services (name, category, base_price, is_custom_price, is_active) VALUES
('Ressemelage complet homme', 'cordonnerie_homme', 15000, false, true),
('Demi-semelle homme', 'cordonnerie_homme', 8000, false, true),
('Talon homme', 'cordonnerie_homme', 5000, false, true),
('Patins homme', 'cordonnerie_homme', 3000, false, true),
('Couture / Recouture homme', 'cordonnerie_homme', 5000, true, true),
('Collage homme', 'cordonnerie_homme', 3000, true, true),
('Teinture chaussure homme', 'cordonnerie_homme', 8000, true, true),
('Cirage / Lustrage homme', 'cordonnerie_homme', 3000, false, true),
('Changement fermeture éclair homme', 'cordonnerie_homme', 7000, true, true),
('Réparation doublure homme', 'cordonnerie_homme', 6000, true, true);

-- Cordonnerie Femme
INSERT INTO public.services (name, category, base_price, is_custom_price, is_active) VALUES
('Ressemelage complet femme', 'cordonnerie_femme', 12000, false, true),
('Demi-semelle femme', 'cordonnerie_femme', 7000, false, true),
('Talon femme (remplacement)', 'cordonnerie_femme', 5000, false, true),
('Bonbout talon aiguille', 'cordonnerie_femme', 2000, false, true),
('Patins femme', 'cordonnerie_femme', 3000, false, true),
('Couture / Recouture femme', 'cordonnerie_femme', 5000, true, true),
('Collage femme', 'cordonnerie_femme', 3000, true, true),
('Teinture chaussure femme', 'cordonnerie_femme', 8000, true, true),
('Changement fermeture éclair femme', 'cordonnerie_femme', 7000, true, true),
('Réparation bride / lanière', 'cordonnerie_femme', 4000, true, true);

-- Sneakers
INSERT INTO public.services (name, category, base_price, is_custom_price, is_active) VALUES
('Nettoyage complet sneakers', 'sneakers', 5000, false, true),
('Nettoyage premium sneakers', 'sneakers', 8000, false, true),
('Déjaunissement semelle', 'sneakers', 6000, false, true),
('Réparation semelle sneakers', 'sneakers', 10000, true, true),
('Recoloration sneakers', 'sneakers', 12000, true, true),
('Customisation sneakers', 'sneakers', 20000, true, true),
('Protection / Imperméabilisation', 'sneakers', 3000, false, true),
('Changement lacets premium', 'sneakers', 2000, false, true),
('Réparation talon intérieur', 'sneakers', 5000, false, true),
('Blanchiment sneakers', 'sneakers', 7000, false, true);

-- Maroquinerie
INSERT INTO public.services (name, category, base_price, is_custom_price, is_active) VALUES
('Nettoyage sac cuir', 'maroquinerie', 10000, false, true),
('Teinture sac', 'maroquinerie', 15000, true, true),
('Réparation couture sac', 'maroquinerie', 8000, true, true),
('Changement fermeture sac', 'maroquinerie', 10000, true, true),
('Réparation anse / bandoulière', 'maroquinerie', 8000, true, true),
('Nettoyage ceinture cuir', 'maroquinerie', 5000, false, true),
('Réparation boucle ceinture', 'maroquinerie', 4000, true, true),
('Teinture ceinture', 'maroquinerie', 7000, true, true),
('Imperméabilisation maroquinerie', 'maroquinerie', 5000, false, true),
('Restauration complète sac', 'maroquinerie', 25000, true, true);
