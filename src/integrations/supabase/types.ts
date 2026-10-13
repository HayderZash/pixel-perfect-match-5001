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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          course_id: string
          created_at: string
          hours: number
          id: string
          instructor_id: string
          session_date: string
          slot_id: string
          submitted_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          hours?: number
          id?: string
          instructor_id: string
          session_date: string
          slot_id: string
          submitted_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          hours?: number
          id?: string
          instructor_id?: string
          session_date?: string
          slot_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      colleges: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      course_instructors: {
        Row: {
          course_id: string
          instructor_id: string
        }
        Insert: {
          course_id: string
          instructor_id: string
        }
        Update: {
          course_id?: string
          instructor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_instructors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          classification: Database["public"]["Enums"]["course_classification"]
          code: string
          created_at: string
          credit_hours: number
          department_id: string
          ects: number | null
          id: string
          name: string
          practical_hours: number
          semester_weeks: number
          stage: number
          theoretical_hours: number
        }
        Insert: {
          classification?: Database["public"]["Enums"]["course_classification"]
          code: string
          created_at?: string
          credit_hours?: number
          department_id: string
          ects?: number | null
          id?: string
          name: string
          practical_hours?: number
          semester_weeks?: number
          stage?: number
          theoretical_hours?: number
        }
        Update: {
          classification?: Database["public"]["Enums"]["course_classification"]
          code?: string
          created_at?: string
          credit_hours?: number
          department_id?: string
          ects?: number | null
          id?: string
          name?: string
          practical_hours?: number
          semester_weeks?: number
          stage?: number
          theoretical_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          college_id: string
          created_at: string
          id: string
          name: string
          stages_count: number
        }
        Insert: {
          code?: string | null
          college_id: string
          created_at?: string
          id?: string
          name: string
          stages_count?: number
        }
        Update: {
          code?: string | null
          college_id?: string
          created_at?: string
          id?: string
          name?: string
          stages_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "departments_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      halls: {
        Row: {
          capacity: number | null
          college_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          college_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          college_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "halls_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          instructor_id: string
          kind: string
          link_url: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          instructor_id: string
          kind?: string
          link_url?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          instructor_id?: string
          kind?: string
          link_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      library_resources: {
        Row: {
          author: string | null
          category: string | null
          college_id: string | null
          created_at: string
          department_id: string | null
          file_path: string | null
          id: string
          link_url: string | null
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          uploaded_by: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          college_id?: string | null
          created_at?: string
          department_id?: string | null
          file_path?: string | null
          id?: string
          link_url?: string | null
          title: string
          type?: Database["public"]["Enums"]["resource_type"]
          uploaded_by?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          college_id?: string | null
          created_at?: string
          department_id?: string | null
          file_path?: string | null
          id?: string
          link_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["resource_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_resources_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_resources_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          created_at: string
          id: string
          is_broadcast: boolean
          read_at: string | null
          receiver_id: string
          sender_id: string
          subject: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          receiver_id: string
          sender_id: string
          subject?: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_rank: Database["public"]["Enums"]["academic_rank"] | null
          avatar_url: string | null
          college_id: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_profile_locked: boolean
          phone: string | null
          section: string | null
          stage: number | null
          sub_group: string | null
          username: string
        }
        Insert: {
          academic_rank?: Database["public"]["Enums"]["academic_rank"] | null
          avatar_url?: string | null
          college_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          is_profile_locked?: boolean
          phone?: string | null
          section?: string | null
          stage?: number | null
          sub_group?: string | null
          username: string
        }
        Update: {
          academic_rank?: Database["public"]["Enums"]["academic_rank"] | null
          avatar_url?: string | null
          college_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_profile_locked?: boolean
          phone?: string | null
          section?: string | null
          stage?: number | null
          sub_group?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_login_tokens: {
        Row: {
          created_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          enabled: boolean
          feature: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          enabled?: boolean
          feature: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          enabled?: boolean
          feature?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          department_id: string
          hall_id: string | null
          id: string
          instructor_id: string | null
          period_end: string
          period_start: string
          section: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          stage: number
          sub_group: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          department_id: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          period_end: string
          period_start: string
          section?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          stage: number
          sub_group?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          department_id?: string
          hall_id?: string | null
          id?: string
          instructor_id?: string | null
          period_end?: string
          period_start?: string
          section?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          stage?: number
          sub_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_manage_college: { Args: { _college: string }; Returns: boolean }
      can_manage_department: { Args: { _dept: string }; Returns: boolean }
      can_message: {
        Args: { _receiver: string; _sender: string }
        Returns: boolean
      }
      can_view_student: { Args: { _student: string }; Returns: boolean }
      get_absence_report: {
        Args: never
        Returns: {
          absence_pct: number
          absent_hours: number
          college_id: string
          course_code: string
          course_id: string
          course_name: string
          department_id: string
          excused_hours: number
          full_name: string
          section: string
          stage: number
          student_id: string
          total_hours: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_session_instructor: { Args: { _session: string }; Returns: boolean }
      is_session_student: { Args: { _session: string }; Returns: boolean }
      is_top_admin: { Args: { _user_id: string }; Returns: boolean }
      profile_college: { Args: { _user_id: string }; Returns: string }
      profile_department: { Args: { _user_id: string }; Returns: string }
      user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      academic_rank:
        | "professor"
        | "assistant_professor"
        | "lecturer"
        | "assistant_lecturer"
      app_role:
        | "system_admin"
        | "super_admin"
        | "college_admin"
        | "dept_admin"
        | "instructor"
        | "student"
        | "registrar"
      attendance_status: "present" | "absent" | "excused"
      course_classification: "general" | "specialized" | "supportive" | "core"
      resource_type: "book" | "paper" | "magazine" | "thesis"
      session_type: "theory" | "practical"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      academic_rank: [
        "professor",
        "assistant_professor",
        "lecturer",
        "assistant_lecturer",
      ],
      app_role: [
        "system_admin",
        "super_admin",
        "college_admin",
        "dept_admin",
        "instructor",
        "student",
        "registrar",
      ],
      attendance_status: ["present", "absent", "excused"],
      course_classification: ["general", "specialized", "supportive", "core"],
      resource_type: ["book", "paper", "magazine", "thesis"],
      session_type: ["theory", "practical"],
    },
  },
} as const
