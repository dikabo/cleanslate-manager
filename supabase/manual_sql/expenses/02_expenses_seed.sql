-- Charges management - seed data only
-- Execute this after 01_expenses_schema.sql

INSERT INTO public.expense_catalog (
  name,
  category,
  subcategory,
  default_unit,
  default_unit_price,
  notes
)
VALUES
  ('Baobab', 'variable', 'produits_atelier', 'unite', 6500, 'Consommable atelier'),
  ('Eau clients', 'variable', 'accueil', 'lot', 1250, 'Accueil client'),
  ('Black', 'variable', 'produits_atelier', 'unite', 5000, 'Produit atelier'),
  ('Martini blanc', 'variable', 'accueil', 'unite', 8500, 'Accueil ou reception'),
  ('Bonbons', 'variable', 'accueil', 'lot', 2000, 'Accueil client'),
  ('Teinture', 'variable', 'produits_atelier', 'unite', 4500, 'Teinture'),
  ('Sacs en carton', 'variable', 'emballage', 'lot', 8500, 'Packaging'),
  ('Sacs Annette', 'variable', 'emballage', 'lot', 10000, 'Packaging'),
  ('Manolo', 'variable', 'produits_atelier', 'unite', 5000, 'Produit atelier'),
  ('Detergents et divers atelier', 'variable', 'entretien', 'lot', 10000, 'Diluant, javel, sucres, detergent'),
  ('Spray', 'variable', 'produits_atelier', 'unite', 2000, 'Produit atelier'),
  ('Sacs noirs recyclage', 'variable', 'emballage', 'unite', 100, 'Gestion emballage'),
  ('Bonbons et mouchoirs', 'variable', 'accueil', 'lot', 5500, 'Accueil client'),
  ('Tonton', 'variable', 'produits_atelier', 'unite', 4000, 'Produit atelier'),
  ('Coton-tige, colle, pinceaux', 'variable', 'fournitures_atelier', 'lot', 12500, 'Petit materiel'),
  ('Emballage cartons', 'variable', 'emballage', 'lot', 8000, 'Packaging'),
  ('The menthe', 'variable', 'accueil', 'lot', 1500, 'Accueil client'),
  ('Julio express', 'variable', 'transport_ponctuel', 'course', 8500, 'Transport variable'),
  ('Lingettes', 'variable', 'entretien', 'lot', 500, 'Consommable entretien'),
  ('Privat', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Didier', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Laila', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Mohamed', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Transport', 'fixed', 'transport_fixe', 'mois', NULL, 'Transport recurrent'),
  ('Tago', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Tago Cedric', 'fixed', 'remuneration', 'mois', NULL, 'Charge fixe recurrente'),
  ('Credit', 'fixed', 'financement', 'mois', NULL, 'Mensualite ou remboursement')
ON CONFLICT (name, category, subcategory) DO UPDATE
SET
  default_unit = EXCLUDED.default_unit,
  default_unit_price = EXCLUDED.default_unit_price,
  notes = EXCLUDED.notes,
  is_active = TRUE,
  updated_at = NOW();

-- Optional sample entries for quick testing
-- Uncomment if you want immediate test data
/*
INSERT INTO public.expense_entries (
  catalog_id,
  designation,
  category,
  subcategory,
  allocation_scope,
  amount,
  expense_date,
  notes
)
SELECT
  id,
  name,
  category,
  subcategory,
  CASE WHEN category = 'fixed' THEN 'month' ELSE 'period' END,
  COALESCE(default_amount, default_unit_price, 0),
  CURRENT_DATE,
  'Entree de test'
FROM public.expense_catalog
WHERE name IN ('Privat', 'Transport', 'Teinture', 'Lingettes');
*/
