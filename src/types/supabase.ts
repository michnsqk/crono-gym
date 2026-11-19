export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string
          id: string
          target: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string
          id?: string
          target?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          banner_path: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["announcement_kind"]
          message: string
          starts_at: string
          title: string
        }
        Insert: {
          banner_path?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          kind?: Database["public"]["Enums"]["announcement_kind"]
          message: string
          starts_at?: string
          title: string
        }
        Update: {
          banner_path?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["announcement_kind"]
          message?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      athlete_phases: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          phase: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          phase?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          phase?: string
          updated_at?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arm_cm: number | null
          body_fat_pct: number | null
          calf_cm: number | null
          chest_cm: number | null
          created_at: string
          hips_cm: number | null
          id: string
          measured_on: string
          note: string | null
          shoulder_cm: number | null
          thigh_cm: number | null
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          measured_on?: string
          note?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          measured_on?: string
          note?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bodyweight_entries: {
        Row: {
          created_at: string
          id: string
          measured_on: string
          note: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_on?: string
          note?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_on?: string
          note?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "bodyweight_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      class_bookings: {
        Row: {
          athlete_name: string
          booking_date: string
          class_id: string
          created_at: string
          id: string
          schedule_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          athlete_name?: string
          booking_date?: string
          class_id: string
          created_at?: string
          id?: string
          schedule_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          athlete_name?: string
          booking_date?: string
          class_id?: string
          created_at?: string
          id?: string
          schedule_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "gym_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_exercise_requests: {
        Row: {
          body_part: string
          coach_id: string
          created_at: string
          equipment: string
          id: string
          name: string
          notes: string | null
          status: string
        }
        Insert: {
          body_part?: string
          coach_id: string
          created_at?: string
          equipment?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
        }
        Update: {
          body_part?: string
          coach_id?: string
          created_at?: string
          equipment?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      coach_login_attempts: {
        Row: {
          attempted_at: string | null
          coach_id: string | null
          id: string
          succeeded: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          coach_id?: string | null
          id?: string
          succeeded?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          coach_id?: string | null
          id?: string
          succeeded?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_login_attempts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          request_id: string | null
          sender_id: string | null
          sender_role: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          request_id?: string | null
          sender_id?: string | null
          sender_role?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          request_id?: string | null
          sender_id?: string | null
          sender_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "coach_session_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          athlete_id: string
          coach_id: string
          content: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          content?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          content?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_offers: {
        Row: {
          benefits: string[]
          billing_cycle: string
          coach_id: string
          price_mxn: number
          shift: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          benefits?: string[]
          billing_cycle?: string
          coach_id: string
          price_mxn?: number
          shift?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          benefits?: string[]
          billing_cycle?: string
          coach_id?: string
          price_mxn?: number
          shift?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_rate_limits: {
        Row: {
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      coach_session_requests: {
        Row: {
          athlete_id: string
          athlete_notes: string | null
          coach_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_notes?: string | null
          coach_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_notes?: string | null
          coach_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_session_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_usage: {
        Row: {
          created_at: string | null
          id: string
          model: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      coaches: {
        Row: {
          created_at: string
          display_name: string
          full_name: string | null
          id: string
          is_active: boolean
          is_available: boolean
          is_provisional: boolean
          name: string | null
          pin_hash: string
          shift: string | null
          specialties: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_provisional?: boolean
          name?: string | null
          pin_hash: string
          shift?: string | null
          specialties?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_provisional?: boolean
          name?: string | null
          pin_hash?: string
          shift?: string | null
          specialties?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      completed_sets: {
        Row: {
          exercise_id: string
          id: string
          is_warmup: boolean
          log_id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          set_number: number
          weight: number | null
        }
        Insert: {
          exercise_id: string
          id?: string
          is_warmup?: boolean
          log_id: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number: number
          weight?: number | null
        }
        Update: {
          exercise_id?: string
          id?: string
          is_warmup?: boolean
          log_id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "completed_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_sets_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          available_in_cronos_gym: boolean | null
          body_part: string
          equipment: string
          equipment_id: string | null
          equipment_name: string | null
          gif_url: string
          id: string
          image: string | null
          instructions: string[]
          is_active: boolean
          is_hidden: boolean
          movement_pattern: string | null
          muscle_group: string | null
          name: string
          name_es: string | null
          station_key: string | null
          target: string
          updated_at: string | null
        }
        Insert: {
          available_in_cronos_gym?: boolean | null
          body_part: string
          equipment: string
          equipment_id?: string | null
          equipment_name?: string | null
          gif_url: string
          id: string
          image?: string | null
          instructions?: string[]
          is_active?: boolean
          is_hidden?: boolean
          movement_pattern?: string | null
          muscle_group?: string | null
          name: string
          name_es?: string | null
          station_key?: string | null
          target: string
          updated_at?: string | null
        }
        Update: {
          available_in_cronos_gym?: boolean | null
          body_part?: string
          equipment?: string
          equipment_id?: string | null
          equipment_name?: string | null
          gif_url?: string
          id?: string
          image?: string | null
          instructions?: string[]
          is_active?: boolean
          is_hidden?: boolean
          movement_pattern?: string | null
          muscle_group?: string | null
          name?: string
          name_es?: string | null
          station_key?: string | null
          target?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gym_attendance: {
        Row: {
          checked_in_at: string
          checked_in_on: string
          display_name: string | null
          id: string
          source: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_on?: string
          display_name?: string | null
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_on?: string
          display_name?: string | null
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      gym_challenges: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          month_label: string
          target_sessions: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id: string
          month_label?: string
          target_sessions?: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          month_label?: string
          target_sessions?: number
          title?: string
        }
        Relationships: []
      }
      gym_classes: {
        Row: {
          capacity: number | null
          created_at: string | null
          day_of_week: string
          id: string
          instructor: string | null
          is_active: boolean | null
          start_time: string
          title: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          day_of_week: string
          id?: string
          instructor?: string | null
          is_active?: boolean | null
          start_time: string
          title: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          day_of_week?: string
          id?: string
          instructor?: string | null
          is_active?: boolean | null
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      gym_schedules: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          start_time: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          start_time: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_service_status: {
        Row: {
          id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      machine_reports: {
        Row: {
          created_at: string
          equipment_id: string
          equipment_name: string
          id: string
          reason: string
          reported_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          equipment_name?: string
          id: string
          reason: string
          reported_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          equipment_name?: string
          id?: string
          reason?: string
          reported_by?: string | null
          status?: string
        }
        Relationships: []
      }
      product_tickets: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number | null
          status: string | null
          total_price: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          status?: string | null
          total_price: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          status?: string | null
          total_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          stock: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          stock?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          stock?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          experience_level: string
          goal: string
          guardian_consent_at: string | null
          height_cm: number | null
          injuries_or_notes: string | null
          is_premium: boolean
          is_vip: boolean
          onboarding_completed_at: string | null
          preferred_session_minutes: number
          premium_expires_at: string | null
          premium_since: string | null
          sex: string | null
          training_location: string
          unit_system: string
          updated_at: string
          user_id: string
          vip_activated_at: string | null
          vip_status: string | null
          weekly_days_target: number
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string
          goal?: string
          guardian_consent_at?: string | null
          height_cm?: number | null
          injuries_or_notes?: string | null
          is_premium?: boolean
          is_vip?: boolean
          onboarding_completed_at?: string | null
          preferred_session_minutes?: number
          premium_expires_at?: string | null
          premium_since?: string | null
          sex?: string | null
          training_location?: string
          unit_system?: string
          updated_at?: string
          user_id: string
          vip_activated_at?: string | null
          vip_status?: string | null
          weekly_days_target?: number
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string
          goal?: string
          guardian_consent_at?: string | null
          height_cm?: number | null
          injuries_or_notes?: string | null
          is_premium?: boolean
          is_vip?: boolean
          onboarding_completed_at?: string | null
          preferred_session_minutes?: number
          premium_expires_at?: string | null
          premium_since?: string | null
          sex?: string | null
          training_location?: string
          unit_system?: string
          updated_at?: string
          user_id?: string
          vip_activated_at?: string | null
          vip_status?: string | null
          weekly_days_target?: number
          weight_kg?: number | null
        }
        Relationships: []
      }
      purchase_tickets: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: Database["public"]["Enums"]["purchase_ticket_status"]
          ticket_number: string
          total_cents: number
          unit_price_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["purchase_ticket_status"]
          ticket_number: string
          total_cents: number
          unit_price_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["purchase_ticket_status"]
          ticket_number?: string
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      role_invites: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      routine_exercises: {
        Row: {
          day_index: number
          day_label: string
          exercise_id: string
          id: string
          order_index: number
          rest_seconds: number
          routine_id: string
          target_reps_max: number | null
          target_reps_min: number | null
          target_sets: number
        }
        Insert: {
          day_index?: number
          day_label?: string
          exercise_id: string
          id?: string
          order_index: number
          rest_seconds?: number
          routine_id: string
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets: number
        }
        Update: {
          day_index?: number
          day_label?: string
          exercise_id?: string
          id?: string
          order_index?: number
          rest_seconds?: number
          routine_id?: string
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_exercises_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_template_exercises: {
        Row: {
          day_index: number
          day_label: string | null
          exercise_id: string
          id: string
          order_index: number
          rest_seconds: number | null
          target_reps_max: number | null
          target_reps_min: number | null
          target_sets: number
          template_id: string
        }
        Insert: {
          day_index?: number
          day_label?: string | null
          exercise_id: string
          id?: string
          order_index?: number
          rest_seconds?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number
          template_id: string
        }
        Update: {
          day_index?: number
          day_label?: string | null
          exercise_id?: string
          id?: string
          order_index?: number
          rest_seconds?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          goal: string | null
          id: string
          is_published: boolean
          level: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal?: string | null
          id?: string
          is_published?: boolean
          level?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal?: string | null
          id?: string
          is_published?: boolean
          level?: string
          title?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_source?: "self" | "coach" | "template" | null
          coach_notes?: string | null
          is_favorite?: boolean
          authored_by_coach: string | null
          created_at: string
          description: string | null
          id: string
          is_template: boolean
          source: string
          title: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_source?: "self" | "coach" | "template" | null
          coach_notes?: string | null
          is_favorite?: boolean
          authored_by_coach?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          source?: string
          title: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_source?: "self" | "coach" | "template" | null
          coach_notes?: string | null
          is_favorite?: boolean
          authored_by_coach?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_authored_by_coach_fkey"
            columns: ["authored_by_coach"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      session_checkins: {
        Row: {
          checked_on: string
          created_at: string
          energy: number | null
          id: string
          motivation: number | null
          notes: string | null
          sleep_hours: number | null
          soreness: number | null
          stress: number | null
          user_id: string
          workout_log_id: string | null
        }
        Insert: {
          checked_on?: string
          created_at?: string
          energy?: number | null
          id?: string
          motivation?: number | null
          notes?: string | null
          sleep_hours?: number | null
          soreness?: number | null
          stress?: number | null
          user_id: string
          workout_log_id?: string | null
        }
        Update: {
          checked_on?: string
          created_at?: string
          energy?: number | null
          id?: string
          motivation?: number | null
          notes?: string | null
          sleep_hours?: number | null
          soreness?: number | null
          stress?: number | null
          user_id?: string
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_checkins_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_routines: {
        Row: {
          clone_count: number
          code: string
          created_at: string
          description: string | null
          owner_id: string
          owner_name: string
          payload: Json
          routine_id: string | null
          title: string
        }
        Insert: {
          clone_count?: number
          code: string
          created_at?: string
          description?: string | null
          owner_id: string
          owner_name?: string
          payload: Json
          routine_id?: string | null
          title: string
        }
        Update: {
          clone_count?: number
          code?: string
          created_at?: string
          description?: string | null
          owner_id?: string
          owner_name?: string
          payload?: Json
          routine_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_routines_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_requests: {
        Row: {
          athlete_name: string
          created_at: string
          exercise_name: string
          id: string
          station_label: string
          status: string
          user_id: string | null
        }
        Insert: {
          athlete_name?: string
          created_at?: string
          exercise_name: string
          id: string
          station_label?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          athlete_name?: string
          created_at?: string
          exercise_name?: string
          id?: string
          station_label?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      store_intents: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_title: string
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          item_id: string
          item_title: string
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_title?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          completed_at: string | null
          id: string
          journal_notes: string | null
          routine_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          journal_notes?: string | null
          routine_id?: string | null
          started_at: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          journal_notes?: string | null
          routine_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_vip: { Args: { target_user_id: string }; Returns: undefined }
      book_gym_class: {
        Args: {
          p_athlete_name?: string
          p_booking_date?: string
          p_class_id: string
          p_schedule_id?: string
        }
        Returns: Json
      }
      finalize_session:
        | {
            Args: {
              p_duration_seconds: number
              p_ended_at: string
              p_log_id: string
              p_name: string
              p_notes: string
              p_routine_id: string
              p_sets: Json
              p_started_at: string
              p_user_id: string
            }
            Returns: string
          }
        | { Args: { p_session_id: string }; Returns: undefined }
      get_admin_attendance_radar: {
        Args: never
        Returns: {
          at_risk: boolean
          days_inactive: number
          display_name: string
          last_visit_at: string
          user_id: string
          visits_30d: number
        }[]
      }
      get_class_seat_counts: {
        Args: { p_booking_date?: string }
        Returns: {
          class_id: string
          confirmed_count: number
        }[]
      }
      get_monthly_challenge_leaderboard: {
        Args: { p_month_start?: string }
        Returns: {
          display_name: string
          last_activity_at: string
          sessions_count: number
          user_id: string
        }[]
      }
      grant_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_email: string
        }
        Returns: undefined
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      increment_shared_routine_clone: {
        Args: { p_code: string }
        Returns: number
      }
      is_coach: { Args: never; Returns: boolean }
      my_roles: { Args: never; Returns: string[] }
    }
    Enums: {
      announcement_kind: "promo" | "notice" | "event"
      app_role: "athlete" | "coach" | "admin" | "developer"
      product_category: "supplements" | "accessories" | "clothing" | "other"
      purchase_ticket_status: "pending" | "paid" | "delivered" | "cancelled"
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
      announcement_kind: ["promo", "notice", "event"],
      app_role: ["athlete", "coach", "admin", "developer"],
      product_category: ["supplements", "accessories", "clothing", "other"],
      purchase_ticket_status: ["pending", "paid", "delivered", "cancelled"],
    },
  },
} as const

export type RoutineExercise = Database["public"]["Tables"]["routine_exercises"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type CompletedSet = Database["public"]["Tables"]["completed_sets"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type BodyweightEntry = Database["public"]["Tables"]["bodyweight_entries"]["Row"];
export type BodyMeasurement = Database["public"]["Tables"]["body_measurements"]["Row"];
export type SessionCheckin = Database["public"]["Tables"]["session_checkins"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type PurchaseTicketRow = Database["public"]["Tables"]["purchase_tickets"]["Row"];
export type GymClassRow = Database["public"]["Tables"]["gym_classes"]["Row"];
export type GymScheduleRow = Database["public"]["Tables"]["gym_schedules"]["Row"];
export type CoachOfferRow = Database["public"]["Tables"]["coach_offers"]["Row"];
export type CoachExerciseRequestRow = Database["public"]["Tables"]["coach_exercise_requests"]["Row"];
export type RoutineTemplateRow = Database["public"]["Tables"]["routine_templates"]["Row"];
export type MachineReportRow = Database["public"]["Tables"]["machine_reports"]["Row"];
export type SpotRequestRow = Database["public"]["Tables"]["spot_requests"]["Row"];
export type GymChallengeRow = Database["public"]["Tables"]["gym_challenges"]["Row"];
export type DemandIntentRow = Database["public"]["Tables"]["store_intents"]["Row"];

/**
 * The human-coaching & chat table rows.
 */
export type CoachProfileRow = Database["public"]["Tables"]["coaches"]["Row"];
export type CoachLoginAttemptRow = Database["public"]["Tables"]["coach_login_attempts"]["Row"];
export type CoachRequestRow = Database["public"]["Tables"]["coach_session_requests"]["Row"];
export type CoachMessageRow = Database["public"]["Tables"]["coach_messages"]["Row"];
export type CoachNoteRow = Database["public"]["Tables"]["coach_notes"]["Row"];
export type AthletePhaseRow = Database["public"]["Tables"]["athlete_phases"]["Row"];
export type ChatSessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

/**
 * Who authored a routine.
 */
export type RoutineAuthor = "user" | "human_coach" | "ai";
export type RoutineSource = RoutineAuthor | null;

/**
 * Tipos de dominio que varios módulos importan de `@/types/supabase`.
 */
type DbExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type OptionalExerciseGovernanceKeys =
  | "equipment_id"
  | "equipment_name"
  | "station_key"
  | "movement_pattern"
  | "available_in_cronos_gym"
  | "image"
  | "updated_at"
  | "muscle_group";

export type Exercise = Omit<DbExerciseRow, OptionalExerciseGovernanceKeys> &
  Partial<Pick<DbExerciseRow, Exclude<OptionalExerciseGovernanceKeys, "muscle_group">>> & {
    muscle_group?: string;
  };

export type Routine = Database["public"]["Tables"]["routines"]["Row"];
export type SharedRoutineRow = Database["public"]["Tables"]["shared_routines"]["Row"];
export type GymAttendanceRow = Database["public"]["Tables"]["gym_attendance"]["Row"];
export type ClassBookingRow = Database["public"]["Tables"]["class_bookings"]["Row"];

