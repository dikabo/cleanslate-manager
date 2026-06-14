-- Charges management - verification checks
-- Execute this after all previous scripts

-- 1. Check tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('expense_catalog', 'expense_entries')
ORDER BY table_name;

-- 2. Check columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('expense_catalog', 'expense_entries')
ORDER BY table_name, ordinal_position;

-- 3. Check policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('expense_catalog', 'expense_entries')
ORDER BY tablename, policyname;

-- 4. Check seed catalog
SELECT category, subcategory, COUNT(*) AS items_count
FROM public.expense_catalog
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- 5. Check views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'v_expense_summary_by_period',
    'v_expense_monthly_summary',
    'v_financial_overview'
  )
ORDER BY table_name;

-- 6. Quick totals
SELECT
  category,
  COUNT(*) AS entries_count,
  COALESCE(SUM(amount), 0) AS total_amount
FROM public.expense_entries
GROUP BY category
ORDER BY category;

-- 7. Monthly financial overview preview
SELECT *
FROM public.v_financial_overview
ORDER BY period_month DESC
LIMIT 12;
