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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_key: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          block: number
          can_do_es: string
          cefr: Database["public"]["Enums"]["cefr_level"]
          chunk_target_cumulative: number
          l1_support_level: number
          title_es: string
        }
        Insert: {
          block: number
          can_do_es: string
          cefr: Database["public"]["Enums"]["cefr_level"]
          chunk_target_cumulative: number
          l1_support_level: number
          title_es: string
        }
        Update: {
          block?: number
          can_do_es?: string
          cefr?: Database["public"]["Enums"]["cefr_level"]
          chunk_target_cumulative?: number
          l1_support_level?: number
          title_es?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string
          id: string
          name: string
          role_en: string
          role_es: string
          speaks_english: string
          voice: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          role_en: string
          role_es: string
          speaks_english: string
          voice: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role_en?: string
          role_es?: string
          speaks_english?: string
          voice?: string
        }
        Relationships: []
      }
      chunks: {
        Row: {
          accepts: Json
          audio_urls: Json
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at: string
          en_text: string
          es_gloss: string
          example_en: string
          example_es: string
          id: string
          slots: Json
          tags: Json
          unit_id: string
        }
        Insert: {
          accepts?: Json
          audio_urls?: Json
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          en_text: string
          es_gloss: string
          example_en: string
          example_es: string
          id: string
          slots?: Json
          tags?: Json
          unit_id: string
        }
        Update: {
          accepts?: Json
          audio_urls?: Json
          cefr?: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          en_text?: string
          es_gloss?: string
          example_en?: string
          example_es?: string
          id?: string
          slots?: Json
          tags?: Json
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      contrast_sets: {
        Row: {
          contrast: Database["public"]["Enums"]["contrast"]
          created_at: string
          explain_es: string
          title_es: string
        }
        Insert: {
          contrast: Database["public"]["Enums"]["contrast"]
          created_at?: string
          explain_es: string
          title_es: string
        }
        Update: {
          contrast?: Database["public"]["Enums"]["contrast"]
          created_at?: string
          explain_es?: string
          title_es?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          completed: boolean
          id: string
          is_speaking: boolean
          progress: number
          quest_date: string
          quest_type: string
          target: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          is_speaking?: boolean
          progress?: number
          quest_date: string
          quest_type: string
          target: number
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          is_speaking?: boolean
          progress?: number
          quest_date?: string
          quest_type?: string
          target?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dialogue_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          dialogue_id: string
          id: string
          path_taken: Json
          used_text_fallback: boolean
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dialogue_id: string
          id?: string
          path_taken?: Json
          used_text_fallback?: boolean
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dialogue_id?: string
          id?: string
          path_taken?: Json
          used_text_fallback?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogue_runs_dialogue_id_fkey"
            columns: ["dialogue_id"]
            isOneToOne: false
            referencedRelation: "dialogues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialogue_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dialogues: {
        Row: {
          character_id: string
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["speaking_mode"]
          nodes: Json
          scenario_en: string
          scenario_es: string
          unit_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id: string
          mode: Database["public"]["Enums"]["speaking_mode"]
          nodes: Json
          scenario_en: string
          scenario_es: string
          unit_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["speaking_mode"]
          nodes?: Json
          scenario_en?: string
          scenario_es?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogues_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialogues_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      error_events: {
        Row: {
          corrected_text: string | null
          created_at: string
          error_type: string
          id: string
          source: string
          user_id: string
          user_text: string
        }
        Insert: {
          corrected_text?: string | null
          created_at?: string
          error_type: string
          id?: string
          source: string
          user_id: string
          user_text: string
        }
        Update: {
          corrected_text?: string | null
          created_at?: string
          error_type?: string
          id?: string
          source?: string
          user_id?: string
          user_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at: string
          es_pattern: string
          fillers: Json
          id: string
          literal_fillers: Json
          pattern: string
          slot: string
          tags: Json
          unit_id: string
        }
        Insert: {
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          es_pattern: string
          fillers?: Json
          id: string
          literal_fillers?: Json
          pattern: string
          slot: string
          tags?: Json
          unit_id: string
        }
        Update: {
          cefr?: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          es_pattern?: string
          fillers?: Json
          id?: string
          literal_fillers?: Json
          pattern?: string
          slot?: string
          tags?: Json
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "frames_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      known_words: {
        Row: {
          added_at: string
          source: string
          user_id: string
          word: string
        }
        Insert: {
          added_at?: string
          source?: string
          user_id: string
          word: string
        }
        Update: {
          added_at?: string
          source?: string
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "known_words_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      minimal_pairs: {
        Row: {
          audio: Json
          contrast: Database["public"]["Enums"]["contrast"]
          id: string
          ipa_a: string
          ipa_b: string
          word_a: string
          word_b: string
        }
        Insert: {
          audio?: Json
          contrast: Database["public"]["Enums"]["contrast"]
          id: string
          ipa_a: string
          ipa_b: string
          word_a: string
          word_b: string
        }
        Update: {
          audio?: Json
          contrast?: Database["public"]["Enums"]["contrast"]
          id?: string
          ipa_a?: string
          ipa_b?: string
          word_a?: string
          word_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "minimal_pairs_contrast_fkey"
            columns: ["contrast"]
            isOneToOne: false
            referencedRelation: "contrast_sets"
            referencedColumns: ["contrast"]
          },
        ]
      }
      mission_reports: {
        Row: {
          attempted: boolean
          created_at: string
          difficulty_felt: number | null
          id: string
          mission_id: string
          recording_path: string | null
          user_id: string
          was_understood: string | null
        }
        Insert: {
          attempted?: boolean
          created_at?: string
          difficulty_felt?: number | null
          id?: string
          mission_id: string
          recording_path?: string | null
          user_id: string
          was_understood?: string | null
        }
        Update: {
          attempted?: boolean
          created_at?: string
          difficulty_felt?: number | null
          id?: string
          mission_id?: string
          recording_path?: string | null
          user_id?: string
          was_understood?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          alternate_es: string | null
          created_at: string
          difficulty: number
          id: string
          instructions_es: string
          prep_chunk_ids: Json
          prep_dialogue_id: string | null
          title_es: string
          unit_id: string
        }
        Insert: {
          alternate_es?: string | null
          created_at?: string
          difficulty?: number
          id: string
          instructions_es: string
          prep_chunk_ids?: Json
          prep_dialogue_id?: string | null
          title_es: string
          unit_id: string
        }
        Update: {
          alternate_es?: string | null
          created_at?: string
          difficulty?: number
          id?: string
          instructions_es?: string
          prep_chunk_ids?: Json
          prep_dialogue_id?: string | null
          title_es?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_prep_dialogue_id_fkey"
            columns: ["prep_dialogue_id"]
            isOneToOne: false
            referencedRelation: "dialogues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          audio_url: string | null
          character_id: string
          created_at: string
          duration_s: number | null
          id: string
          questions: Json
          title_es: string
          transcript: Json
          unit_id: string
        }
        Insert: {
          audio_url?: string | null
          character_id: string
          created_at?: string
          duration_s?: number | null
          id: string
          questions: Json
          title_es: string
          transcript: Json
          unit_id: string
        }
        Update: {
          audio_url?: string | null
          character_id?: string
          created_at?: string
          duration_s?: number | null
          id?: string
          questions?: Json
          title_es?: string
          transcript?: Json
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          completed_at: string | null
          duration_s: number
          id: string
          speaking_tasks_completed: number
          stage_reached: Database["public"]["Enums"]["session_stage"]
          started_at: string
          unit_id: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          completed_at?: string | null
          duration_s?: number
          id?: string
          speaking_tasks_completed?: number
          stage_reached?: Database["public"]["Enums"]["session_stage"]
          started_at?: string
          unit_id: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          completed_at?: string | null
          duration_s?: number
          id?: string
          speaking_tasks_completed?: number
          stage_reached?: Database["public"]["Enums"]["session_stage"]
          started_at?: string
          unit_id?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shadowing_attempts: {
        Row: {
          created_at: string
          id: string
          recording_path: string | null
          scene_id: string
          segment_index: number
          stage: Database["public"]["Enums"]["shadowing_stage"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recording_path?: string | null
          scene_id: string
          segment_index: number
          stage: Database["public"]["Enums"]["shadowing_stage"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recording_path?: string | null
          scene_id?: string
          segment_index?: number
          stage?: Database["public"]["Enums"]["shadowing_stage"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadowing_attempts_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadowing_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          accent: string
          attribution: string | null
          created_at: string
          gender: string
          id: string
          l1: string
          native: boolean
          source: string
        }
        Insert: {
          accent: string
          attribution?: string | null
          created_at?: string
          gender: string
          id: string
          l1: string
          native: boolean
          source: string
        }
        Update: {
          accent?: string
          attribution?: string | null
          created_at?: string
          gender?: string
          id?: string
          l1?: string
          native?: boolean
          source?: string
        }
        Relationships: []
      }
      speaking_samples: {
        Row: {
          created_at: string
          duration_s: number | null
          id: string
          prompt_es: string
          prompt_id: string
          recording_path: string
          user_id: string
          week_number: number
        }
        Insert: {
          created_at?: string
          duration_s?: number | null
          id?: string
          prompt_es: string
          prompt_id: string
          recording_path: string
          user_id: string
          week_number: number
        }
        Update: {
          created_at?: string
          duration_s?: number | null
          id?: string
          prompt_es?: string
          prompt_id?: string
          recording_path?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "speaking_samples_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          block: number
          can_do_es: string
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at: string
          id: string
          order: number
          target_contrast: Database["public"]["Enums"]["contrast"]
          title_en: string
          title_es: string
        }
        Insert: {
          block: number
          can_do_es: string
          cefr: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          id: string
          order: number
          target_contrast: Database["public"]["Enums"]["contrast"]
          title_en: string
          title_es: string
        }
        Update: {
          block?: number
          can_do_es?: string
          cefr?: Database["public"]["Enums"]["cefr_level"]
          created_at?: string
          id?: string
          order?: number
          target_contrast?: Database["public"]["Enums"]["contrast"]
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_block_fkey"
            columns: ["block"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["block"]
          },
        ]
      }
      user_cards: {
        Row: {
          chunk_id: string
          created_at: string
          difficulty: number
          due_at: string
          elapsed_days: number
          fsrs_state: number
          gloss_reveals: number
          id: string
          lapses: number
          last_mode: Database["public"]["Enums"]["review_mode"] | null
          last_review_at: string | null
          learning_steps: number
          produce_passes: number
          reps: number
          scheduled_days: number
          stability: number
          state: Database["public"]["Enums"]["card_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          difficulty?: number
          due_at?: string
          elapsed_days?: number
          fsrs_state?: number
          gloss_reveals?: number
          id?: string
          lapses?: number
          last_mode?: Database["public"]["Enums"]["review_mode"] | null
          last_review_at?: string | null
          learning_steps?: number
          produce_passes?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: Database["public"]["Enums"]["card_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          difficulty?: number
          due_at?: string
          elapsed_days?: number
          fsrs_state?: number
          gloss_reveals?: number
          id?: string
          lapses?: number
          last_mode?: Database["public"]["Enums"]["review_mode"] | null
          last_review_at?: string | null
          learning_steps?: number
          produce_passes?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: Database["public"]["Enums"]["card_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contrast_stats: {
        Row: {
          attempts: number
          contrast: Database["public"]["Enums"]["contrast"]
          correct: number
          last_seen_at: string | null
          recent: boolean[]
          retired_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          contrast: Database["public"]["Enums"]["contrast"]
          correct?: number
          last_seen_at?: string | null
          recent?: boolean[]
          retired_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          contrast?: Database["public"]["Enums"]["contrast"]
          correct?: number
          last_seen_at?: string | null
          recent?: boolean[]
          retired_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contrast_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          current_block: number
          current_consecutive_days: number
          current_unit: string | null
          daily_goal_minutes: number
          days_practiced: number
          id: string
          immersion_mode: boolean
          l1_support_level: number
          last_practiced_on: string | null
          leagues_opted_in: boolean
          mic_permission: string | null
          motivation: Database["public"]["Enums"]["motivation"] | null
          native_language: string
          onboarded_at: string | null
          timezone: string
          total_xp: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_block?: number
          current_consecutive_days?: number
          current_unit?: string | null
          daily_goal_minutes?: number
          days_practiced?: number
          id: string
          immersion_mode?: boolean
          l1_support_level?: number
          last_practiced_on?: string | null
          leagues_opted_in?: boolean
          mic_permission?: string | null
          motivation?: Database["public"]["Enums"]["motivation"] | null
          native_language?: string
          onboarded_at?: string | null
          timezone?: string
          total_xp?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_block?: number
          current_consecutive_days?: number
          current_unit?: string | null
          daily_goal_minutes?: number
          days_practiced?: number
          id?: string
          immersion_mode?: boolean
          l1_support_level?: number
          last_practiced_on?: string | null
          leagues_opted_in?: boolean
          mic_permission?: string | null
          motivation?: Database["public"]["Enums"]["motivation"] | null
          native_language?: string
          onboarded_at?: string | null
          timezone?: string
          total_xp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_current_block_fkey"
            columns: ["current_block"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["block"]
          },
          {
            foreignKeyName: "users_current_unit_fkey"
            columns: ["current_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      card_state: "new" | "learning" | "review" | "learned"
      cefr_level: "A0" | "A1" | "A1+" | "A2" | "A2+" | "B1"
      contrast:
        | "ee_ih"
        | "schwa"
        | "final_clusters"
        | "b_v"
        | "s_onset"
        | "aspiration"
        | "th"
        | "h_r"
        | "stress_intonation"
      motivation: "work" | "travel" | "family" | "study" | "other"
      review_mode: "recognize" | "produce_typed" | "produce_spoken"
      session_stage: "ear" | "meet" | "absorb" | "retrieve" | "speak"
      shadowing_stage: "listen" | "repeat" | "shadow"
      speaking_mode: "scripted" | "guided" | "open_response"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      card_state: ["new", "learning", "review", "learned"],
      cefr_level: ["A0", "A1", "A1+", "A2", "A2+", "B1"],
      contrast: [
        "ee_ih",
        "schwa",
        "final_clusters",
        "b_v",
        "s_onset",
        "aspiration",
        "th",
        "h_r",
        "stress_intonation",
      ],
      motivation: ["work", "travel", "family", "study", "other"],
      review_mode: ["recognize", "produce_typed", "produce_spoken"],
      session_stage: ["ear", "meet", "absorb", "retrieve", "speak"],
      shadowing_stage: ["listen", "repeat", "shadow"],
      speaking_mode: ["scripted", "guided", "open_response"],
    },
  },
} as const
