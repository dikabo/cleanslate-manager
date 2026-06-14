-- ============================================================
-- Migration: Auto-calculate partner statistics via trigger
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add active_items_count column to partners
ALTER TABLE "public"."partners"
ADD COLUMN IF NOT EXISTS "active_items_count" INTEGER DEFAULT 0;

-- 2. Create or replace the trigger function
CREATE OR REPLACE FUNCTION recalculate_partner_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_partner_id UUID;
BEGIN
  -- Determine which partner to recalculate for
  IF TG_OP = 'DELETE' THEN
    target_partner_id := OLD.assigned_to_partner_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recalculate for both old and new partner if the assignment changed
    IF OLD.assigned_to_partner_id IS DISTINCT FROM NEW.assigned_to_partner_id THEN
      -- Recalculate OLD partner first
      IF OLD.assigned_to_partner_id IS NOT NULL THEN
        UPDATE partners SET
          total_orders = COALESCE((
            SELECT COUNT(*) FROM order_items WHERE assigned_to_partner_id = OLD.assigned_to_partner_id
          ), 0),
          average_rating = COALESCE((
            SELECT ROUND(AVG(quality_rating)::numeric, 1)
            FROM order_items
            WHERE assigned_to_partner_id = OLD.assigned_to_partner_id
              AND quality_rating IS NOT NULL
          ), 0),
          active_items_count = COALESCE((
            SELECT COUNT(*) FROM order_items
            WHERE assigned_to_partner_id = OLD.assigned_to_partner_id
              AND status IN ('sent_to_partner', 'at_partner')
          ), 0),
          updated_at = NOW()
        WHERE id = OLD.assigned_to_partner_id;
      END IF;
    END IF;
    target_partner_id := NEW.assigned_to_partner_id;
  ELSE
    -- INSERT
    target_partner_id := NEW.assigned_to_partner_id;
  END IF;

  -- Recalculate for the target partner
  IF target_partner_id IS NOT NULL THEN
    UPDATE partners SET
      total_orders = COALESCE((
        SELECT COUNT(*) FROM order_items WHERE assigned_to_partner_id = target_partner_id
      ), 0),
      average_rating = COALESCE((
        SELECT ROUND(AVG(quality_rating)::numeric, 1)
        FROM order_items
        WHERE assigned_to_partner_id = target_partner_id
          AND quality_rating IS NOT NULL
      ), 0),
      active_items_count = COALESCE((
        SELECT COUNT(*) FROM order_items
        WHERE assigned_to_partner_id = target_partner_id
          AND status IN ('sent_to_partner', 'at_partner')
      ), 0),
      updated_at = NOW()
    WHERE id = target_partner_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_recalculate_partner_stats ON order_items;

CREATE TRIGGER trg_recalculate_partner_stats
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION recalculate_partner_stats();

-- 4. Backfill: recalculate stats for all existing partners
UPDATE partners p SET
  total_orders = COALESCE(sub.cnt, 0),
  average_rating = COALESCE(sub.avg_rating, 0),
  active_items_count = COALESCE(sub.active_cnt, 0),
  updated_at = NOW()
FROM (
  SELECT
    assigned_to_partner_id,
    COUNT(*) AS cnt,
    ROUND(AVG(quality_rating) FILTER (WHERE quality_rating IS NOT NULL)::numeric, 1) AS avg_rating,
    COUNT(*) FILTER (WHERE status IN ('sent_to_partner', 'at_partner')) AS active_cnt
  FROM order_items
  WHERE assigned_to_partner_id IS NOT NULL
  GROUP BY assigned_to_partner_id
) sub
WHERE p.id = sub.assigned_to_partner_id;
