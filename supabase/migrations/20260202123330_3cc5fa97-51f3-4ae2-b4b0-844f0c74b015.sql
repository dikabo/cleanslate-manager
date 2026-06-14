-- ========================================
-- CLEAN UP MANAGER - FULL DATABASE SCHEMA V2
-- ========================================

-- 1. ENUMS & TYPES
-- ========================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 
  'manager', 
  'receptionist', 
  'artisan', 
  'delivery', 
  'partner'
);

-- Order status enum
CREATE TYPE public.order_status AS ENUM (
  'received',
  'diagnostic',
  'treatment',
  'sent_to_partner',
  'received_from_partner',
  'quality',
  'ready',
  'delivered'
);

-- Article type enum
CREATE TYPE public.article_type AS ENUM (
  'sneakers',
  'boots',
  'heels',
  'loafers',
  'bag',
  'belt',
  'other'
);

-- Material enum
CREATE TYPE public.material_type AS ENUM (
  'leather',
  'suede',
  'nubuck',
  'canvas',
  'synthetic',
  'mixed'
);

-- Partner specialty enum
CREATE TYPE public.partner_specialty AS ENUM (
  'cordonnerie',
  'teinture',
  'couture',
  'nettoyage',
  'reparation'
);

-- Service category enum
CREATE TYPE public.service_category AS ENUM (
  'cordonnerie_homme',
  'cordonnerie_femme',
  'sneakers',
  'maroquinerie'
);

-- Item status for individual service lines
CREATE TYPE public.item_status AS ENUM (
  'pending',
  'in_progress',
  'sent_to_partner',
  'at_partner',
  'received_from_partner',
  'completed'
);

-- Stock category enum
CREATE TYPE public.stock_category AS ENUM (
  'consumable',
  'product'
);

-- 2. USER ROLES TABLE (for RBAC)
-- ========================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any admin/manager role
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'manager')
  )
$$;

-- 3. PROFILES TABLE
-- ========================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  
  -- Default role is receptionist
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'receptionist');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. PARTNERS TABLE
-- ========================================

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty partner_specialty NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  average_rating NUMERIC(2,1) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 5. CLIENTS TABLE
-- ========================================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  preferences TEXT,
  loyalty_points INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 6. SERVICES TABLE
-- ========================================

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category service_category NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_custom_price BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 7. ORDERS TABLE
-- ========================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  article_type article_type NOT NULL,
  brand TEXT,
  material material_type NOT NULL,
  color TEXT,
  status order_status NOT NULL DEFAULT 'received',
  diagnosis TEXT,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES auth.users(id),
  signature_url TEXT,
  estimated_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Generate ticket number function
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  today_count INTEGER;
  today_date TEXT;
BEGIN
  today_date := to_char(now(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders
  WHERE to_char(created_at, 'YYYYMMDD') = today_date;
  
  NEW.ticket_number := 'CU-' || today_date || '-' || LPAD(today_count::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION public.generate_ticket_number();

-- 8. ORDER ITEMS TABLE (Hybrid Assignment - Core V2 Feature)
-- ========================================

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT NOT NULL,
  service_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  status item_status NOT NULL DEFAULT 'pending',
  assigned_to_partner_id UUID REFERENCES public.partners(id),
  is_internal BOOLEAN DEFAULT true,
  partner_cost NUMERIC(10,2),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  rating_notes TEXT,
  sent_to_partner_at TIMESTAMP WITH TIME ZONE,
  received_from_partner_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 9. PHOTOS TABLE
-- ========================================

CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('before', 'after')),
  annotations TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- 10. STOCK ITEMS TABLE
-- ========================================

CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category stock_category NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'unité',
  price NUMERIC(10,2),
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- 11. UPDATE TIMESTAMP TRIGGER
-- ========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. RLS POLICIES
-- ========================================

-- Profiles: Users can view all profiles, update their own
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User Roles: Only admins/managers can manage, all can view own
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- Partners: All authenticated can view, admins/managers can manage
CREATE POLICY "Authenticated users can view partners" ON public.partners
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- Clients: All authenticated can view and manage
CREATE POLICY "Authenticated users can manage clients" ON public.clients
  FOR ALL TO authenticated USING (true);

-- Services: All can view, admins can manage
CREATE POLICY "Authenticated users can view services" ON public.services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- Orders: All authenticated can view and manage
CREATE POLICY "Authenticated users can manage orders" ON public.orders
  FOR ALL TO authenticated USING (true);

-- Order Items: All authenticated can view and manage
CREATE POLICY "Authenticated users can manage order items" ON public.order_items
  FOR ALL TO authenticated USING (true);

-- Photos: All authenticated can view and manage
CREATE POLICY "Authenticated users can manage photos" ON public.photos
  FOR ALL TO authenticated USING (true);

-- Stock: All authenticated can view, admins/managers can manage
CREATE POLICY "Authenticated users can view stock" ON public.stock_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage stock" ON public.stock_items
  FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 13. PARTNER RATING UPDATE FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.update_partner_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quality_rating IS NOT NULL AND NEW.assigned_to_partner_id IS NOT NULL THEN
    UPDATE public.partners
    SET 
      average_rating = (
        SELECT ROUND(AVG(quality_rating)::numeric, 1)
        FROM public.order_items
        WHERE assigned_to_partner_id = NEW.assigned_to_partner_id
          AND quality_rating IS NOT NULL
      ),
      total_orders = (
        SELECT COUNT(*)
        FROM public.order_items
        WHERE assigned_to_partner_id = NEW.assigned_to_partner_id
          AND status = 'completed'
      )
    WHERE id = NEW.assigned_to_partner_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_partner_rating_on_item_update
  AFTER UPDATE ON public.order_items
  FOR EACH ROW
  WHEN (NEW.quality_rating IS DISTINCT FROM OLD.quality_rating)
  EXECUTE FUNCTION public.update_partner_rating();

-- 14. STORAGE BUCKET FOR PHOTOS
-- ========================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-photos', 'order-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-photos');

CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-photos');