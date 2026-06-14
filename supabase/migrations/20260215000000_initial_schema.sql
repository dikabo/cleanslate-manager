-- 1. CRÉATION DES TYPES (ENUMS) [cite: 63]
-- Ces types limitent les valeurs possibles pour garantir la cohérence des données.

CREATE TYPE app_role AS ENUM (
  'super_admin', 'manager', 'receptionist', 'artisan', 'delivery', 'partner'
);

CREATE TYPE order_status AS ENUM (
  'received', 'diagnostic', 'treatment', 'sent_to_partner', 
  'received_from_partner', 'quality', 'ready', 'delivered'
);

CREATE TYPE article_type AS ENUM (
  'sneakers', 'boots', 'heels', 'loafers', 'bag', 'belt', 'other'
);

CREATE TYPE material_type AS ENUM (
  'leather', 'suede', 'nubuck', 'canvas', 'synthetic', 'mixed'
);

CREATE TYPE partner_specialty AS ENUM (
  'cordonnerie', 'teinture', 'couture', 'nettoyage', 'reparation'
);

CREATE TYPE service_category AS ENUM (
  'cordonnerie_homme', 'cordonnerie_femme', 'sneakers', 'maroquinerie'
);

CREATE TYPE item_status AS ENUM (
  'pending', 'in_progress', 'sent_to_partner', 'at_partner', 
  'received_from_partner', 'completed'
);

CREATE TYPE stock_category AS ENUM (
  'consumable', 'product'
);

-- 2. CRÉATION DES TABLES PRINCIPALES [cite: 61]

-- Table des Profils Utilisateurs (liée à auth.users de Supabase)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Rôles (RBAC)
CREATE TABLE public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'receptionist', -- [cite: 67]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Clients
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  loyalty_points INT DEFAULT 0,
  orders_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Partenaires (Sous-traitants)
CREATE TABLE public.partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  partner_specialty partner_specialty[], -- Peut avoir plusieurs spécialités
  average_rating NUMERIC DEFAULT 5.0,
  total_orders INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  contact_info TEXT, -- [cite: 183]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Stocks
CREATE TABLE public.stock_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  stock_category stock_category NOT NULL,
  quantity INT DEFAULT 0,
  min_threshold INT DEFAULT 5,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table du Catalogue de Services
CREATE TABLE public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  service_category service_category,
  base_price NUMERIC NOT NULL,
  is_custom_price BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRÉATION DES TABLES DE COMMANDES (Le coeur du système)

-- Table des Commandes (Le "Dossier" global)
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL, -- À générer via fonction ou trigger idéalement
  client_id UUID REFERENCES public.clients(id),
  status order_status DEFAULT 'received',
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Articles dans une commande (ex: "Paire de Nike", "Sac Gucci")
CREATE TABLE public.order_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  article_type article_type,
  material_type material_type,
  brand TEXT,
  position INT, -- Pour l'ordre d'affichage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Tâches/Services par Article (ex: "Nettoyage" sur l'article 1)
CREATE TABLE public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.order_articles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  assigned_to_partner_id UUID REFERENCES public.partners(id), -- [cite: 187]
  price NUMERIC NOT NULL,
  item_status item_status DEFAULT 'pending',
  is_internal BOOLEAN DEFAULT true,
  partner_cost NUMERIC, -- [cite: 190]
  quality_rating INT CHECK (quality_rating BETWEEN 1 AND 5), -- [cite: 189]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des Photos (Avant/Après)
CREATE TABLE public.photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT CHECK (type IN ('before', 'after')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACTIVATION DE LA SÉCURITÉ (RLS) [cite: 65]
-- On active la sécurité par défaut pour tout verrouiller.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 5. STOCKAGE (BUCKET) [cite: 70]
-- Note: Le bucket se crée via l'interface "Storage" ou via script API, 
-- mais voici la table systeme pour info (ne pas exécuter si fait via UI).
INSERT INTO storage.buckets (id, name, public) VALUES ('order-photos', 'order-photos', true);