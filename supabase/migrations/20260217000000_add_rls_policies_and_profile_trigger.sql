-- ============================================================
-- MIGRATION: RLS Policies + Auto Profile Creation Trigger
-- ============================================================

-- ============================================================
-- 1. TRIGGER: Auto-create profile when a new user signs up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NOW(),
    NOW()
  );

  -- Auto-assign 'receptionist' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'receptionist');

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. RLS POLICIES: profiles
-- ============================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert for the trigger (SECURITY DEFINER handles this)
-- Also allow authenticated users to insert their own profile as fallback
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 3. RLS POLICIES: user_roles
-- ============================================================

-- Users can read their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Only admins can manage roles (insert/update/delete)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- ============================================================
-- 4. RLS POLICIES: clients
-- ============================================================

-- All authenticated users can view clients
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create clients
CREATE POLICY "Authenticated users can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update clients
CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- 5. RLS POLICIES: orders
-- ============================================================

CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- 6. RLS POLICIES: order_articles
-- ============================================================

CREATE POLICY "Authenticated users can view order_articles"
  ON public.order_articles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create order_articles"
  ON public.order_articles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_articles"
  ON public.order_articles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete order_articles"
  ON public.order_articles FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 7. RLS POLICIES: order_items
-- ============================================================

CREATE POLICY "Authenticated users can view order_items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create order_items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete order_items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 8. RLS POLICIES: services
-- ============================================================

CREATE POLICY "Authenticated users can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- ============================================================
-- 9. RLS POLICIES: partners
-- ============================================================

CREATE POLICY "Authenticated users can view partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create partners"
  ON public.partners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update partners"
  ON public.partners FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- 10. RLS POLICIES: stock_items
-- ============================================================

CREATE POLICY "Authenticated users can view stock_items"
  ON public.stock_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage stock_items"
  ON public.stock_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stock_items"
  ON public.stock_items FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- 11. RLS POLICIES: photos
-- ============================================================

CREATE POLICY "Authenticated users can view photos"
  ON public.photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload photos"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete photos"
  ON public.photos FOR DELETE
  TO authenticated
  USING (true);
