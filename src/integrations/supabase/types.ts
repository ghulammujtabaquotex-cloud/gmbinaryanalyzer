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
      analysis_usage: {
        Row: {
          created_at: string
          id: string
          request_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      future_signals_pool: {
        Row: {
          confidence: number | null
          created_at: string
          direction: string
          id: string
          pair: string
          signal_time: string
          telegram_sent: boolean | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          direction: string
          id?: string
          pair: string
          signal_time: string
          telegram_sent?: boolean | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          direction?: string
          id?: string
          pair?: string
          signal_time?: string
          telegram_sent?: boolean | null
        }
        Relationships: []
      }
      ip_usage: {
        Row: {
          created_at: string
          future_signal_count: number | null
          id: string
          ip_address: string
          request_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          future_signal_count?: number | null
          id?: string
          ip_address: string
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          created_at?: string
          future_signal_count?: number | null
          id?: string
          ip_address?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          access_token: string | null
          admin_notes: string | null
          amount: number
          created_at: string
          email: string | null
          generated_password: string | null
          id: string
          proof_image_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          token_expires_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          admin_notes?: string | null
          amount: number
          created_at?: string
          email?: string | null
          generated_password?: string | null
          id?: string
          proof_image_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          token_expires_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          admin_notes?: string | null
          amount?: number
          created_at?: string
          email?: string | null
          generated_password?: string | null
          id?: string
          proof_image_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          token_expires_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pending_feedback: {
        Row: {
          created_at: string
          id: string
          pair: string
          signal: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair: string
          signal: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair?: string
          signal?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_history: {
        Row: {
          confidence: number | null
          created_at: string
          explanation: string | null
          id: string
          pair: string
          resistance_zone: string | null
          result: string | null
          signal: string
          support_zone: string | null
          trend: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          pair: string
          resistance_zone?: string | null
          result?: string | null
          signal: string
          support_zone?: string | null
          trend: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          pair?: string
          resistance_zone?: string | null
          result?: string | null
          signal?: string
          support_zone?: string | null
          trend?: string
          user_id?: string
        }
        Relationships: []
      }
      signals_history: {
        Row: {
          created_at: string
          direction: string
          id: string
          ip_address: string | null
          pair: string
          signal_time: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          ip_address?: string | null
          pair: string
          signal_time: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          ip_address?: string | null
          pair?: string
          signal_time?: string
          user_id?: string | null
        }
        Relationships: []
      }
      submission_usage: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          submission_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          submission_count?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          submission_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_results: {
        Row: {
          created_at: string
          id: string
          result: string
          signal: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result: string
          signal: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result?: string
          signal?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atomic_increment_ip_usage: {
        Args: {
          p_daily_limit: number
          p_ip_address: string
          p_usage_date: string
        }
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      atomic_increment_submission: {
        Args: {
          p_daily_limit: number
          p_ip_address: string
          p_usage_date: string
        }
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      atomic_increment_usage: {
        Args: { p_daily_limit: number; p_usage_date: string; p_user_id: string }
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      check_email_is_vip: { Args: { p_email: string }; Returns: boolean }
      check_future_signal_usage: {
        Args: {
          p_daily_limit: number
          p_ip_address: string
          p_usage_date: string
        }
        Returns: {
          allowed: boolean
          current_count: number
          remaining: number
        }[]
      }
      check_ip_usage: {
        Args: {
          p_daily_limit: number
          p_ip_address: string
          p_usage_date: string
        }
        Returns: {
          can_analyze: boolean
          remaining: number
          request_count: number
        }[]
      }
      check_payment_request_rate: {
        Args: { p_email: string }
        Returns: boolean
      }
      get_payment_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          email: string
          generated_password: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      get_total_analysis_count: { Args: never; Returns: number }
      get_total_signals_generated: { Args: never; Returns: number }
      get_trade_statistics: {
        Args: never
        Returns: {
          accuracy: number
          total_losses: number
          total_trades: number
          total_wins: number
        }[]
      }
      get_user_accuracy: {
        Args: { p_user_id: string }
        Returns: {
          accuracy: number
          losses: number
          pending: number
          total_signals: number
          wins: number
        }[]
      }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_future_signal_usage: {
        Args: { p_ip_address: string; p_usage_date: string }
        Returns: undefined
      }
      is_vip: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_status: "pending" | "approved" | "rejected"
      subscription_tier: "free" | "vip"
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
      app_role: ["admin", "user"],
      payment_status: ["pending", "approved", "rejected"],
      subscription_tier: ["free", "vip"],
    },
  },
} as const
