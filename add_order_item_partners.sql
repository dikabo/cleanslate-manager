-- 1. Create the new table for multiple partner assignments per service
CREATE TABLE IF NOT EXISTS order_item_partners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    partner_cost NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'assigned', -- 'assigned', 'sent', 'received', 'completed'
    sent_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add RLS Policies for the new table
ALTER TABLE order_item_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on order_item_partners"
    ON order_item_partners FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users on order_item_partners"
    ON order_item_partners FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users on order_item_partners"
    ON order_item_partners FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users on order_item_partners"
    ON order_item_partners FOR DELETE
    USING (auth.role() = 'authenticated');

-- 3. (Optional but recommended) Migrate existing single-partner assignments to the new table
-- This query looks at all order_items that currently have an assigned_to_partner_id
-- and creates a corresponding entry in order_item_partners.
INSERT INTO order_item_partners (order_item_id, partner_id, task_description, partner_cost, status, sent_at, received_at, created_at)
SELECT 
    id AS order_item_id,
    assigned_to_partner_id AS partner_id,
    'Service complet' AS task_description,
    COALESCE(partner_cost, 0) AS partner_cost,
    CASE 
        WHEN status = 'received_from_partner' THEN 'received'
        WHEN status = 'sent_to_partner' THEN 'sent'
        ELSE 'assigned'
    END AS status,
    sent_to_partner_at AS sent_at,
    received_from_partner_at AS received_at,
    COALESCE(created_at, NOW()) AS created_at
FROM order_items
WHERE assigned_to_partner_id IS NOT NULL;
