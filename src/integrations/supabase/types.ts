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
      answer_weights: {
        Row: {
          career_cluster_id: string
          id: string
          question_id: string
          weight: number
        }
        Insert: {
          career_cluster_id: string
          id?: string
          question_id: string
          weight?: number
        }
        Update: {
          career_cluster_id?: string
          id?: string
          question_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_weights_career_cluster_id_fkey"
            columns: ["career_cluster_id"]
            isOneToOne: false
            referencedRelation: "career_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_weights_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          id: string
          question_id: string
          rating: number
          response_id: string
        }
        Insert: {
          id?: string
          question_id: string
          rating: number
          response_id: string
        }
        Update: {
          id?: string
          question_id?: string
          rating?: number
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      career_clusters: {
        Row: {
          color_hex: string
          created_at: string
          description: string
          icon_emoji: string
          id: string
          name: string
          possible_careers: string[]
          questionnaire_id: string | null
          updated_at: string
        }
        Insert: {
          color_hex?: string
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          name: string
          possible_careers?: string[]
          questionnaire_id?: string | null
          updated_at?: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          name?: string
          possible_careers?: string[]
          questionnaire_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          stream: string | null
          user_id: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          stream?: string | null
          user_id: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          stream?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questionnaire_clusters: {
        Row: {
          career_cluster_id: string
          created_at: string | null
          id: string
          questionnaire_id: string
        }
        Insert: {
          career_cluster_id: string
          created_at?: string | null
          id?: string
          questionnaire_id: string
        }
        Update: {
          career_cluster_id?: string
          created_at?: string | null
          id?: string
          questionnaire_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_clusters_career_cluster_id_fkey"
            columns: ["career_cluster_id"]
            isOneToOne: false
            referencedRelation: "career_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_clusters_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          id: string
          order_index: number
          section_id: string
          statement: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          section_id: string
          statement?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          section_id?: string
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          id: string
          questionnaire_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          id?: string
          questionnaire_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          id?: string
          questionnaire_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          career_cluster_id: string
          id: string
          response_id: string
          total_score: number
        }
        Insert: {
          career_cluster_id: string
          id?: string
          response_id: string
          total_score?: number
        }
        Update: {
          career_cluster_id?: string
          id?: string
          response_id?: string
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_career_cluster_id_fkey"
            columns: ["career_cluster_id"]
            isOneToOne: false
            referencedRelation: "career_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          description: string
          id: string
          order_index: number
          questionnaire_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          questionnaire_id: string
          title?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          questionnaire_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_questionnaire_clusters: {
        Args: { q_id: string }
        Returns: {
          color: string
          description: string
          icon: string
          id: string
          name: string
        }[]
      }
      get_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "setter" | "student"
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
      app_role: ["setter", "student"],
    },
  },
} as const
