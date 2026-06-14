    -- ============================================================
    -- FIX: Secure RLS policies based on user roles
    -- This migration replaces the permissive 'USING (true)' policies
    -- with strict Role-Based Access Control (RBAC).
    --
    -- Access rules:
    -- Super Admins, Managers, Receptionists: Full access (CRUD)
    -- Artisans, Delivery, Partners: Blocked (No access for now)
    -- ============================================================

    -- 1. Create a helper function to check roles securely and efficiently
    CREATE OR REPLACE FUNCTION public.has_admin_or_receptionist_role()
    RETURNS boolean AS $$
    BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'manager', 'receptionist')
    );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2. Drop the existing permissive policies created in 20260220125000
    -- orders
    DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
    DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
    DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
    DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;

    -- order_articles
    DROP POLICY IF EXISTS "Authenticated users can view order_articles" ON public.order_articles;
    DROP POLICY IF EXISTS "Authenticated users can create order_articles" ON public.order_articles;
    DROP POLICY IF EXISTS "Authenticated users can update order_articles" ON public.order_articles;
    DROP POLICY IF EXISTS "Authenticated users can delete order_articles" ON public.order_articles;
    DROP POLICY IF EXISTS "Authenticated users can manage order articles" ON public.order_articles;

    -- order_items
    DROP POLICY IF EXISTS "Authenticated users can view order_items" ON public.order_items;
    DROP POLICY IF EXISTS "Authenticated users can create order_items" ON public.order_items;
    DROP POLICY IF EXISTS "Authenticated users can update order_items" ON public.order_items;
    DROP POLICY IF EXISTS "Authenticated users can delete order_items" ON public.order_items;

    -- photos
    DROP POLICY IF EXISTS "Authenticated users can view photos" ON public.photos;
    DROP POLICY IF EXISTS "Authenticated users can upload photos" ON public.photos;
    DROP POLICY IF EXISTS "Authenticated users can create photos" ON public.photos;
    DROP POLICY IF EXISTS "Authenticated users can delete photos" ON public.photos;

    -- clients
    DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
    DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
    DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;

    -- partners
    DROP POLICY IF EXISTS "Authenticated users can view partners" ON public.partners;
    DROP POLICY IF EXISTS "Authenticated users can create partners" ON public.partners;
    DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.partners;

    -- stock_items
    DROP POLICY IF EXISTS "Authenticated users can view stock_items" ON public.stock_items;
    DROP POLICY IF EXISTS "Authenticated users can manage stock_items" ON public.stock_items;
    DROP POLICY IF EXISTS "Authenticated users can update stock_items" ON public.stock_items;

    -- services
    DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
    DROP POLICY IF EXISTS "Members can view services" ON public.services;
    DROP POLICY IF EXISTS "Admins can insert services" ON public.services;
    DROP POLICY IF EXISTS "Admins can update services" ON public.services;


    -- 3. Create explicit policies for admins, managers, and receptionists

    -- orders
    CREATE POLICY "Admins and Receptionists can view orders" ON public.orders FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update orders" ON public.orders FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete orders" ON public.orders FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- order_articles
    CREATE POLICY "Admins and Receptionists can view order_articles" ON public.order_articles FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create order_articles" ON public.order_articles FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update order_articles" ON public.order_articles FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete order_articles" ON public.order_articles FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- order_items
    CREATE POLICY "Admins and Receptionists can view order_items" ON public.order_items FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update order_items" ON public.order_items FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete order_items" ON public.order_items FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- photos
    CREATE POLICY "Admins and Receptionists can view photos" ON public.photos FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete photos" ON public.photos FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- clients
    CREATE POLICY "Admins and Receptionists can view clients" ON public.clients FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update clients" ON public.clients FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- partners
    CREATE POLICY "Admins and Receptionists can view partners" ON public.partners FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create partners" ON public.partners FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update partners" ON public.partners FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete partners" ON public.partners FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- stock_items
    CREATE POLICY "Admins and Receptionists can view stock_items" ON public.stock_items FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can manage stock_items" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update stock_items" ON public.stock_items FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete stock_items" ON public.stock_items FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());

    -- services
    CREATE POLICY "Admins and Receptionists can view services" ON public.services FOR SELECT TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can create services" ON public.services FOR INSERT TO authenticated WITH CHECK (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can update services" ON public.services FOR UPDATE TO authenticated USING (has_admin_or_receptionist_role());
    CREATE POLICY "Admins and Receptionists can delete services" ON public.services FOR DELETE TO authenticated USING (has_admin_or_receptionist_role());
