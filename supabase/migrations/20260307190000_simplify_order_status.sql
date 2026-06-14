-- Simplify order_status enum: remove diagnostic, treatment, quality; add validated
-- Run this MANUALLY in Supabase SQL Editor

-- 1. Migrate existing orders to new statuses
UPDATE orders SET status = 'received' WHERE status IN ('diagnostic', 'treatment');
UPDATE orders SET status = 'received_from_partner' WHERE status = 'quality';

-- 2. Drop the default on the status column (it references old enum)
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

-- 3. Recreate the enum
ALTER TYPE order_status RENAME TO order_status_old;
CREATE TYPE order_status AS ENUM ('received', 'validated', 'sent_to_partner', 'received_from_partner', 'ready', 'delivered');
ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::text::order_status;
DROP TYPE order_status_old;

-- 4. Re-add the default
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'received'::order_status;
