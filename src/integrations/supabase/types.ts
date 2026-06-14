export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          orders_count: number | null
          phone: string
          preferences: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          orders_count?: number | null
          phone: string
          preferences?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          orders_count?: number | null
          phone?: string
          preferences?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_catalog: {
        Row: {
          category: string
          created_at: string
          default_amount: number | null
          default_quantity: number | null
          default_unit: string | null
          default_unit_price: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          subcategory: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_amount?: number | null
          default_quantity?: number | null
          default_unit?: string | null
          default_unit_price?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          subcategory: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_amount?: number | null
          default_quantity?: number | null
          default_unit?: string | null
          default_unit_price?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          subcategory?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          allocation_scope: string
          amount: number
          catalog_id: string | null
          category: string
          created_at: string
          created_by: string | null
          designation: string
          expense_date: string
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string | null
          quantity: number | null
          stock_item_id: string | null
          subcategory: string
          supplier: string | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          allocation_scope?: string
          amount?: number
          catalog_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          designation: string
          expense_date?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          stock_item_id?: string | null
          subcategory: string
          supplier?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          allocation_scope?: string
          amount?: number
          catalog_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          designation?: string
          expense_date?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          stock_item_id?: string | null
          subcategory?: string
          supplier?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "expense_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_articles: {
        Row: {
          article_type: Database["public"]["Enums"]["article_type"]
          brand: string | null
          color: string | null
          created_at: string
          custom_article_type: string | null
          description: string | null
          id: string
          material: Database["public"]["Enums"]["material_type"]
          order_id: string
          picked_up_at: string | null
          picked_up_by: string | null
          pickup_group_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          article_type: Database["public"]["Enums"]["article_type"]
          brand?: string | null
          color?: string | null
          created_at?: string
          custom_article_type?: string | null
          description?: string | null
          id?: string
          material: Database["public"]["Enums"]["material_type"]
          order_id: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          pickup_group_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          article_type?: Database["public"]["Enums"]["article_type"]
          brand?: string | null
          color?: string | null
          created_at?: string
          custom_article_type?: string | null
          description?: string | null
          id?: string
          material?: Database["public"]["Enums"]["material_type"]
          order_id?: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          pickup_group_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_articles_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_article_pickups: {
        Row: {
          article_amount: number
          article_id: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          payment_amount: number
          picked_up_at: string
          picked_up_by: string | null
          pickup_group_id: string
        }
        Insert: {
          article_amount?: number
          article_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_amount?: number
          picked_up_at?: string
          picked_up_by?: string | null
          pickup_group_id: string
        }
        Update: {
          article_amount?: number
          article_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_amount?: number
          picked_up_at?: string
          picked_up_by?: string | null
          pickup_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_article_pickups_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "order_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_article_pickups_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_article_pickups_picked_up_by_fkey"
            columns: ["picked_up_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_partners: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          partner_cost: number | null
          partner_id: string
          received_at: string | null
          sent_at: string | null
          status: string | null
          task_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          partner_cost?: number | null
          partner_id: string
          received_at?: string | null
          sent_at?: string | null
          status?: string | null
          task_description: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          partner_cost?: number | null
          partner_id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: string | null
          task_description?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_partners_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          article_id: string | null
          assigned_to_partner_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_internal: boolean | null
          notes: string | null
          order_id: string
          partner_cost: number | null
          price: number
          quality_rating: number | null
          rating_notes: string | null
          received_from_partner_at: string | null
          sent_to_partner_at: string | null
          service_id: string
          service_name: string
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          assigned_to_partner_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean | null
          notes?: string | null
          order_id: string
          partner_cost?: number | null
          price: number
          quality_rating?: number | null
          rating_notes?: string | null
          received_from_partner_at?: string | null
          sent_to_partner_at?: string | null
          service_id: string
          service_name: string
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          assigned_to_partner_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean | null
          notes?: string | null
          order_id?: string
          partner_cost?: number | null
          price?: number
          quality_rating?: number | null
          rating_notes?: string | null
          received_from_partner_at?: string | null
          sent_to_partner_at?: string | null
          service_id?: string
          service_name?: string
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "order_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_assigned_to_partner_id_fkey"
            columns: ["assigned_to_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          article_type: Database["public"]["Enums"]["article_type"]
          assigned_to: string | null
          brand: string | null
          client_id: string
          color: string | null
          created_at: string
          created_by: string | null
          custom_article_type: string | null
          delivered_at: string | null
          diagnosis: string | null
          discount_amount: number
          discount_applied_at: string | null
          discount_reason: string | null
          estimated_date: string | null
          id: string
          is_paid: boolean | null
          material: Database["public"]["Enums"]["material_type"]
          paid_amount: number
          subtotal_amount: number
          signature_url: string | null
          status: Database["public"]["Enums"]["order_status"]
          ticket_number: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          article_type: Database["public"]["Enums"]["article_type"]
          assigned_to?: string | null
          brand?: string | null
          client_id: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          custom_article_type?: string | null
          delivered_at?: string | null
          diagnosis?: string | null
          discount_amount?: number
          discount_applied_at?: string | null
          discount_reason?: string | null
          estimated_date?: string | null
          id?: string
          is_paid?: boolean | null
          material: Database["public"]["Enums"]["material_type"]
          paid_amount?: number
          subtotal_amount?: number
          signature_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_number: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          article_type?: Database["public"]["Enums"]["article_type"]
          assigned_to?: string | null
          brand?: string | null
          client_id?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          custom_article_type?: string | null
          delivered_at?: string | null
          diagnosis?: string | null
          discount_amount?: number
          discount_applied_at?: string | null
          discount_reason?: string | null
          estimated_date?: string | null
          id?: string
          is_paid?: boolean | null
          material?: Database["public"]["Enums"]["material_type"]
          paid_amount?: number
          subtotal_amount?: number
          signature_url?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_number?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          average_rating: number | null
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          specialties: string[] | null
          specialty: Database["public"]["Enums"]["partner_specialty"]
          total_orders: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          specialty: Database["public"]["Enums"]["partner_specialty"]
          total_orders?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          specialties?: string[] | null
          specialty?: Database["public"]["Enums"]["partner_specialty"]
          total_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          annotations: string | null
          article_id: string | null
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          type: string
          url: string
        }
        Insert: {
          annotations?: string | null
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          type: string
          url: string
        }
        Update: {
          annotations?: string | null
          article_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "order_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          id: string
          is_active: boolean | null
          is_custom_price: boolean | null
          name: string
        }
        Insert: {
          base_price?: number
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_custom_price?: boolean | null
          name: string
        }
        Update: {
          base_price?: number
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_custom_price?: boolean | null
          name?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          category: Database["public"]["Enums"]["stock_category"]
          created_at: string
          id: string
          min_threshold: number
          name: string
          price: number | null
          quantity: number
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          id?: string
          min_threshold?: number
          name: string
          price?: number | null
          quantity?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          id?: string
          min_threshold?: number
          name?: string
          price?: number | null
          quantity?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference: string | null
        }
        Insert: {
          amount: number
          collected_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
      | "super_admin"
      | "manager"
      | "receptionist"
      | "artisan"
      | "delivery"
      | "partner"
      article_type:
      | "sneakers"
      | "boots"
      | "heels"
      | "loafers"
      | "bag"
      | "belt"
      | "other"
      item_status:
      | "pending"
      | "in_progress"
      | "sent_to_partner"
      | "at_partner"
      | "received_from_partner"
      | "completed"
      material_type:
      | "leather"
      | "suede"
      | "nubuck"
      | "canvas"
      | "synthetic"
      | "mixed"
      order_status:
      | "received"
      | "validated"
      | "sent_to_partner"
      | "received_from_partner"
      | "ready"
      | "delivered"
      partner_specialty:
      | "cordonnerie"
      | "teinture"
      | "couture"
      | "nettoyage"
      | "reparation"
      service_category:
      | "cordonnerie_homme"
      | "cordonnerie_femme"
      | "sneakers"
      | "maroquinerie"
      stock_category: "consumable" | "product"
      payment_type: "advance" | "balance" | "refund"
      payment_method: "cash" | "mobile_money" | "card" | "transfer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "manager",
        "receptionist",
        "artisan",
        "delivery",
        "partner",
      ],
      article_type: [
        "sneakers",
        "boots",
        "heels",
        "loafers",
        "bag",
        "belt",
        "other",
      ],
      item_status: [
        "pending",
        "in_progress",
        "sent_to_partner",
        "at_partner",
        "received_from_partner",
        "completed",
      ],
      material_type: [
        "leather",
        "suede",
        "nubuck",
        "canvas",
        "synthetic",
        "mixed",
      ],
      order_status: [
        "received",
        "validated",
        "sent_to_partner",
        "received_from_partner",
        "ready",
        "delivered",
      ],
      partner_specialty: [
        "cordonnerie",
        "teinture",
        "couture",
        "nettoyage",
        "reparation",
      ],
      service_category: [
        "cordonnerie_homme",
        "cordonnerie_femme",
        "sneakers",
        "maroquinerie",
      ],
      stock_category: ["consumable", "product"],
      payment_type: ["advance", "balance", "refund"],
      payment_method: ["cash", "mobile_money", "card", "transfer"],
    },
  },
} as const
