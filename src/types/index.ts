// Clean Up Manager - Type Definitions (V2 - Database Aligned)

// Database enum types
export type AppRole = 'super_admin' | 'manager' | 'receptionist' | 'artisan' | 'delivery' | 'partner';

export type OrderStatus =
  | 'received'
  | 'validated'
  | 'sent_to_partner'
  | 'received_from_partner'
  | 'ready'
  | 'delivered';

export type ArticleType =
  | 'sneakers'
  | 'boots'
  | 'heels'
  | 'loafers'
  | 'bag'
  | 'belt'
  | 'other';

export type Material =
  | 'leather'
  | 'suede'
  | 'nubuck'
  | 'canvas'
  | 'synthetic'
  | 'mixed';

export type PartnerSpecialty =
  | 'cordonnerie'
  | 'teinture'
  | 'couture'
  | 'nettoyage'
  | 'reparation';

export type ServiceCategory =
  | 'cordonnerie_homme'
  | 'cordonnerie_femme'
  | 'sneakers'
  | 'maroquinerie';

export type ItemStatus =
  | 'pending'
  | 'in_progress'
  | 'sent_to_partner'
  | 'at_partner'
  | 'received_from_partner'
  | 'completed';

export type StockCategory = 'consumable' | 'product';

export type PaymentType = 'advance' | 'balance' | 'refund';

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'transfer';

export type ExpenseCategory = 'fixed' | 'variable';

export type ExpenseAllocationScope = 'order' | 'day' | 'week' | 'month' | 'period';

// Database-aligned interfaces
export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  specialty: PartnerSpecialty;
  specialties?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  average_rating: number;
  total_orders: number;
  active_items_count?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  preferences?: string;
  loyalty_points: number;
  orders_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrderArticle {
  id: string;
  order_id: string;
  article_type: ArticleType;
  custom_article_type?: string;
  material: Material;
  brand?: string;
  color?: string;
  description?: string;
  position: number;
  picked_up_at?: string;
  picked_up_by?: string;
  pickup_group_id?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  order_items?: OrderItem[];
  photos?: Photo[];
}

export interface OrderArticlePickup {
  id: string;
  order_id: string;
  article_id: string;
  pickup_group_id: string;
  picked_up_at: string;
  picked_up_by?: string;
  article_amount: number;
  payment_amount: number;
  notes?: string;
  created_at: string;
  // Joined data
  order_articles?: OrderArticle;
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  base_price: number;
  is_custom_price: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
  collected_by?: string;
  created_at: string;
}

export interface Order {
  id: string;
  ticket_number: string;
  client_id: string;
  article_type: ArticleType;
  custom_article_type?: string;
  brand?: string;
  material: Material;
  color?: string;
  status: OrderStatus;
  diagnosis?: string;
  subtotal_amount?: number;
  discount_amount?: number;
  discount_reason?: string;
  discount_applied_at?: string;
  total_amount: number;
  paid_amount: number;
  is_paid: boolean;
  assigned_to?: string;
  signature_url?: string;
  estimated_date?: string;
  delivered_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: Client;
  order_articles?: OrderArticle[];
  order_items?: OrderItem[];
  photos?: Photo[];
  payments?: Payment[];
  order_article_pickups?: OrderArticlePickup[];
}

export interface OrderItemPartner {
  id: string;
  order_item_id: string;
  partner_id: string;
  task_description: string;
  partner_cost: number;
  status: 'assigned' | 'sent' | 'received' | 'completed';
  sent_at?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  partners?: Partner;
}

export interface OrderItem {
  id: string;
  order_id: string;
  article_id?: string;
  service_id: string;
  service_name: string;
  price: number;
  notes?: string;
  status: ItemStatus;
  assigned_to_partner_id?: string; // Legacy
  is_internal: boolean;
  partner_cost?: number; // Legacy
  is_partner_paid?: boolean;
  quality_rating?: number;
  rating_notes?: string;
  sent_to_partner_at?: string; // Legacy
  received_from_partner_at?: string; // Legacy
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  partners?: Partner; // Legacy
  order_item_partners?: OrderItemPartner[];
}

export interface Photo {
  id: string;
  order_id: string;
  article_id?: string;
  url: string;
  type: 'before' | 'after';
  annotations?: string;
  created_by?: string;
  created_at: string;
}

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  quantity: number;
  min_threshold: number;
  unit: string;
  price?: number;
  supplier?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCatalogItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  subcategory: string;
  default_unit?: string | null;
  default_unit_price?: number | null;
  default_amount?: number | null;
  default_quantity?: number | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntry {
  id: string;
  catalog_id?: string | null;
  order_id?: string | null;
  stock_item_id?: string | null;
  designation: string;
  category: ExpenseCategory;
  subcategory: string;
  allocation_scope: ExpenseAllocationScope;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  amount: number;
  payment_method?: string | null;
  supplier?: string | null;
  expense_date: string;
  notes?: string | null;
  invoice_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// UI Status helpers
export const statusLabels: Record<OrderStatus, string> = {
  received: 'Réception',
  validated: 'Validée',
  sent_to_partner: 'En Production',
  received_from_partner: 'Production Terminée',
  ready: 'Prêt',
  delivered: 'Livré',
};

export const statusColors: Record<OrderStatus, string> = {
  received: 'bg-blue-100 text-blue-800',
  validated: 'bg-purple-100 text-purple-800',
  sent_to_partner: 'bg-orange-100 text-orange-800',
  received_from_partner: 'bg-cyan-100 text-cyan-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-800',
};

export const articleTypeLabels: Record<ArticleType, string> = {
  sneakers: 'Sneakers',
  boots: 'Bottes',
  heels: 'Talons',
  loafers: 'Mocassins',
  bag: 'Sac',
  belt: 'Ceinture',
  other: 'Autre',
};

export const materialLabels: Record<Material, string> = {
  leather: 'Cuir',
  suede: 'Daim',
  nubuck: 'Nubuck',
  canvas: 'Toile',
  synthetic: 'Synthétique',
  mixed: 'Mixte',
};

export const specialtyLabels: Record<PartnerSpecialty, string> = {
  cordonnerie: 'Cordonnerie',
  teinture: 'Teinture',
  couture: 'Couture',
  nettoyage: 'Nettoyage',
  reparation: 'Réparation',
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  sent_to_partner: 'Expédié',
  at_partner: 'Chez partenaire',
  received_from_partner: 'Reçu du partenaire',
  completed: 'Terminé',
};

export const paymentTypeLabels: Record<PaymentType, string> = {
  advance: 'Avance',
  balance: 'Solde',
  refund: 'Remboursement',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte Bancaire',
  transfer: 'Virement',
};
