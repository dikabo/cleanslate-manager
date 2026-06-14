-- Charges management - reporting views
-- Execute this after schema and seed scripts

CREATE OR REPLACE VIEW public.v_expense_summary_by_period AS
SELECT
  expense_date,
  category,
  subcategory,
  COUNT(*) AS entries_count,
  SUM(amount) AS total_amount
FROM public.expense_entries
GROUP BY expense_date, category, subcategory;

CREATE OR REPLACE VIEW public.v_expense_monthly_summary AS
SELECT
  date_trunc('month', expense_date)::date AS period_month,
  category,
  subcategory,
  COUNT(*) AS entries_count,
  SUM(amount) AS total_amount
FROM public.expense_entries
GROUP BY date_trunc('month', expense_date)::date, category, subcategory;

CREATE OR REPLACE VIEW public.v_financial_overview AS
WITH order_revenue AS (
  SELECT
    date_trunc('month', created_at)::date AS period_month,
    SUM(total_amount) AS total_ca,
    SUM(paid_amount) AS total_paid,
    COUNT(*) AS order_count
  FROM public.orders
  GROUP BY date_trunc('month', created_at)::date
),
partner_costs AS (
  SELECT
    date_trunc('month', created_at)::date AS period_month,
    SUM(CASE WHEN COALESCE(is_internal, FALSE) = FALSE THEN COALESCE(partner_cost, 0) ELSE 0 END) AS total_partner_cost,
    SUM(COALESCE(price, 0)) AS total_item_revenue
  FROM public.order_items
  GROUP BY date_trunc('month', created_at)::date
),
expenses AS (
  SELECT
    date_trunc('month', expense_date)::date AS period_month,
    SUM(CASE WHEN category = 'variable' THEN amount ELSE 0 END) AS total_variable_expenses,
    SUM(CASE WHEN category = 'fixed' THEN amount ELSE 0 END) AS total_fixed_expenses,
    SUM(amount) AS total_expenses
  FROM public.expense_entries
  GROUP BY date_trunc('month', expense_date)::date
)
SELECT
  COALESCE(r.period_month, p.period_month, e.period_month) AS period_month,
  COALESCE(r.total_ca, 0) AS total_ca,
  COALESCE(r.total_paid, 0) AS total_paid,
  COALESCE(r.order_count, 0) AS order_count,
  COALESCE(p.total_partner_cost, 0) AS total_partner_cost,
  COALESCE(e.total_variable_expenses, 0) AS total_variable_expenses,
  COALESCE(e.total_fixed_expenses, 0) AS total_fixed_expenses,
  COALESCE(e.total_expenses, 0) AS total_expenses,
  COALESCE(p.total_item_revenue, 0) - COALESCE(p.total_partner_cost, 0) AS gross_margin_before_expenses,
  (COALESCE(p.total_item_revenue, 0) - COALESCE(p.total_partner_cost, 0)) - COALESCE(e.total_variable_expenses, 0) AS gross_margin_after_variable_expenses,
  (COALESCE(p.total_item_revenue, 0) - COALESCE(p.total_partner_cost, 0)) - COALESCE(e.total_expenses, 0) AS net_operating_profit
FROM order_revenue r
FULL OUTER JOIN partner_costs p
  ON p.period_month = r.period_month
FULL OUTER JOIN expenses e
  ON e.period_month = COALESCE(r.period_month, p.period_month);

COMMENT ON VIEW public.v_expense_summary_by_period IS
'Synthese journaliere des charges par categorie et sous-categorie.';

COMMENT ON VIEW public.v_expense_monthly_summary IS
'Synthese mensuelle des charges par categorie et sous-categorie.';

COMMENT ON VIEW public.v_financial_overview IS
'Vue mensuelle combinant CA, encaissements, couts partenaires, charges variables, charges fixes et resultat net.';
