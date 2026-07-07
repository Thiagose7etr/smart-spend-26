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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          max_accounts: number
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          max_accounts?: number
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          max_accounts?: number
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      combustivel: {
        Row: {
          created_at: string
          data: string
          frota: string | null
          id: string
          movimento: string
          observacao: string | null
          quantidade: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          frota?: string | null
          id?: string
          movimento: string
          observacao?: string | null
          quantidade?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          frota?: string | null
          id?: string
          movimento?: string
          observacao?: string | null
          quantidade?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          ano: number | null
          created_at: string
          data_emissao: string | null
          fornecedor: string | null
          frota: string | null
          id: string
          item: string | null
          mes: string | null
          nf: string | null
          prazo_pag: string | null
          quant: number | null
          tipo: string | null
          updated_at: string
          valor_total: number | null
          valor_unit: number | null
        }
        Insert: {
          ano?: number | null
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          frota?: string | null
          id?: string
          item?: string | null
          mes?: string | null
          nf?: string | null
          prazo_pag?: string | null
          quant?: number | null
          tipo?: string | null
          updated_at?: string
          valor_total?: number | null
          valor_unit?: number | null
        }
        Update: {
          ano?: number | null
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          frota?: string | null
          id?: string
          item?: string | null
          mes?: string | null
          nf?: string | null
          prazo_pag?: string | null
          quant?: number | null
          tipo?: string | null
          updated_at?: string
          valor_total?: number | null
          valor_unit?: number | null
        }
        Relationships: []
      }
      frotas: {
        Row: {
          chassi: string | null
          codigo: string
          created_at: string
          id: string
          marca: string | null
          modelo: string | null
          placa: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          chassi?: string | null
          codigo: string
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          placa?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          chassi?: string | null
          codigo?: string
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          placa?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guincho: {
        Row: {
          created_at: string
          data: string | null
          endereco_entrega: string | null
          endereco_retirada: string | null
          frota: string | null
          id: string
          modelo: string | null
          peso_kg: number | null
          problema: string | null
          status: string | null
          tipo: string | null
          updated_at: string
          motorista_nome: string | null
          motorista_telefone: string | null
        }
        Insert: {
          created_at?: string
          data?: string | null
          endereco_entrega?: string | null
          endereco_retirada?: string | null
          frota?: string | null
          id?: string
          modelo?: string | null
          peso_kg?: number | null
          problema?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
          motorista_nome?: string | null
          motorista_telefone?: string | null
        }
        Update: {
          created_at?: string
          data?: string | null
          endereco_entrega?: string | null
          endereco_retirada?: string | null
          frota?: string | null
          id?: string
          modelo?: string | null
          peso_kg?: number | null
          problema?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
          motorista_nome?: string | null
          motorista_telefone?: string | null
        }
        Relationships: []
      }
      metas: {
        Row: {
          ano: number
          categoria: string
          created_at: string
          id: string
          mes: string
          updated_at: string
          valor_meta: number
        }
        Insert: {
          ano: number
          categoria: string
          created_at?: string
          id?: string
          mes: string
          updated_at?: string
          valor_meta?: number
        }
        Update: {
          ano?: number
          categoria?: string
          created_at?: string
          id?: string
          mes?: string
          updated_at?: string
          valor_meta?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_dashboard_widgets: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          updated_at: string
          user_id: string
          widget: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
          user_id: string
          widget: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          widget?: string
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
      user_tab_permissions: {
        Row: {
          can_edit: boolean
          created_at: string
          id: string
          tab: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          id?: string
          tab: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          id?: string
          tab?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_tab: {
        Args: { _tab: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
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
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
