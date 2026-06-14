-- ============================================================
-- FIX: Ensure all RLS policies are permissive for authenticated users
-- This migration ensures INSERT policies exist on ALL tables
-- even if previous migrations were applied in unexpected order.
-- ============================================================

-- Drop and recreate policies for clean state (idempotent)

-- orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;

CREATE POLICY "Authenticated users can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orders" ON public.orders FOR DELETE TO authenticated USING (true);

-- order_articles
DROP POLICY IF EXISTS "Authenticated users can view order_articles" ON public.order_articles;
DROP POLICY IF EXISTS "Authenticated users can create order_articles" ON public.order_articles;
DROP POLICY IF EXISTS "Authenticated users can update order_articles" ON public.order_articles;
DROP POLICY IF EXISTS "Authenticated users can delete order_articles" ON public.order_articles;
DROP POLICY IF EXISTS "Authenticated users can manage order articles" ON public.order_articles;

CREATE POLICY "Authenticated users can view order_articles" ON public.order_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create order_articles" ON public.order_articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update order_articles" ON public.order_articles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete order_articles" ON public.order_articles FOR DELETE TO authenticated USING (true);

-- order_items
DROP POLICY IF EXISTS "Authenticated users can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can create order_items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can delete order_items" ON public.order_items;

CREATE POLICY "Authenticated users can view order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update order_items" ON public.order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete order_items" ON public.order_items FOR DELETE TO authenticated USING (true);

-- photos
DROP POLICY IF EXISTS "Authenticated users can view photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated users can create photos" ON public.photos;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON public.photos;

CREATE POLICY "Authenticated users can view photos" ON public.photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete photos" ON public.photos FOR DELETE TO authenticated USING (true);

-- clients
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;

CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);

-- partners
DROP POLICY IF EXISTS "Authenticated users can view partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can create partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.partners;

CREATE POLICY "Authenticated users can view partners" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create partners" ON public.partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update partners" ON public.partners FOR UPDATE TO authenticated USING (true);

-- stock_items
DROP POLICY IF EXISTS "Authenticated users can view stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated users can manage stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated users can update stock_items" ON public.stock_items;

CREATE POLICY "Authenticated users can view stock_items" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage stock_items" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_items" ON public.stock_items FOR UPDATE TO authenticated USING (true);

-- services (keep admin policies but also add general read)
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
CREATE POLICY "Authenticated users can view services" ON public.services FOR SELECT TO authenticated USING (true);
-- Insert/update remain admin-only from existing policies
