Scripts SQL manuels pour la gestion des charges.

Ordre d'execution recommande dans Supabase SQL Editor:

1. [01_expenses_schema.sql](/C:/Users/HP%20Pavillon/Documents/Clean%20Up%20Atelier/Prototypes/clean-slate-manager/supabase/manual_sql/expenses/01_expenses_schema.sql)
2. [02_expenses_seed.sql](/C:/Users/HP%20Pavillon/Documents/Clean%20Up%20Atelier/Prototypes/clean-slate-manager/supabase/manual_sql/expenses/02_expenses_seed.sql)
3. [03_expenses_reporting_views.sql](/C:/Users/HP%20Pavillon/Documents/Clean%20Up%20Atelier/Prototypes/clean-slate-manager/supabase/manual_sql/expenses/03_expenses_reporting_views.sql)
4. [04_expenses_verification.sql](/C:/Users/HP%20Pavillon/Documents/Clean%20Up%20Atelier/Prototypes/clean-slate-manager/supabase/manual_sql/expenses/04_expenses_verification.sql)

Notes:

- `01` cree les tables, index, trigger et policies RLS.
- `02` charge le catalogue initial nettoye depuis votre liste de charges.
- `03` cree des vues SQL de synthese pour les rapports.
- `04` permet de verifier rapidement que tout est bien installe.

Le fichier [20260329120000_add_expenses_management.sql](/C:/Users/HP%20Pavillon/Documents/Clean%20Up%20Atelier/Prototypes/clean-slate-manager/supabase/migrations/20260329120000_add_expenses_management.sql) reste disponible comme script complet unique si vous preferez tout avoir dans un seul bloc.
