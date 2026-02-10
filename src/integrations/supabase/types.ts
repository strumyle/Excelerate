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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_grant_admin: boolean | null
          created_at: string | null
          id: string
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          can_grant_admin?: boolean | null
          created_at?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          can_grant_admin?: boolean | null
          created_at?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          status?: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          course_id: string
          created_at: string
          id: string
          issued_at: string
          pdf_path: string | null
          score: number | null
          serial: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          score?: number | null
          serial: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          pdf_path?: string | null
          score?: number | null
          serial?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
      course_modules: {
        Row: {
          chapter_id: string
          content_url: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          is_required: boolean
          position: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_required?: boolean
          position?: number
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_required?: boolean
          position?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_published: boolean | null
          level: string | null
          slug: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean | null
          level?: string | null
          slug?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean | null
          level?: string | null
          slug?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          last_event_at: string
          lesson_id: string
          score: number | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          last_event_at?: string
          lesson_id: string
          score?: number | null
          status: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          last_event_at?: string
          lesson_id?: string
          score?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          duration_minutes: number | null
          external_url: string | null
          id: string
          is_required: boolean
          lesson_kind: Database["public"]["Enums"]["lesson_type"]
          module_id: string
          pass_score_percent: number | null
          quiz_tutorial_id: string | null
          quiz_tutorial_quiz_id: string | null
          reading_md: string | null
          scorm_package_id: string | null
          sort_order: number
          title: string
          updated_at: string
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_required?: boolean
          lesson_kind: Database["public"]["Enums"]["lesson_type"]
          module_id: string
          pass_score_percent?: number | null
          quiz_tutorial_id?: string | null
          quiz_tutorial_quiz_id?: string | null
          reading_md?: string | null
          scorm_package_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_required?: boolean
          lesson_kind?: Database["public"]["Enums"]["lesson_type"]
          module_id?: string
          pass_score_percent?: number | null
          quiz_tutorial_id?: string | null
          quiz_tutorial_quiz_id?: string | null
          reading_md?: string | null
          scorm_package_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_quiz_tutorial_id_fkey"
            columns: ["quiz_tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_scorm_package_id_fkey"
            columns: ["scorm_package_id"]
            isOneToOne: false
            referencedRelation: "scorm_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: number
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: never
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: never
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_id: string
          score: number | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id: string
          score?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id?: string
          score?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          category: string
          correct_answer: string | null
          created_at: string | null
          difficulty: string
          id: string
          options: string[] | null
          points: number
          test_type: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          category: string
          correct_answer?: string | null
          created_at?: string | null
          difficulty: string
          id?: string
          options?: string[] | null
          points?: number
          test_type?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          correct_answer?: string | null
          created_at?: string | null
          difficulty?: string
          id?: string
          options?: string[] | null
          points?: number
          test_type?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scorm_attempts: {
        Row: {
          attempt_no: number
          completed_at: string | null
          created_at: string
          id: string
          package_id: string
          score_max: number | null
          score_min: number | null
          score_raw: number | null
          started_at: string | null
          status: string
          total_time: unknown
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_no?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          package_id: string
          score_max?: number | null
          score_min?: number | null
          score_raw?: number | null
          started_at?: string | null
          status?: string
          total_time?: unknown
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_no?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          package_id?: string
          score_max?: number | null
          score_min?: number | null
          score_raw?: number | null
          started_at?: string | null
          status?: string
          total_time?: unknown
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorm_attempts_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "scorm_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      scorm_cmi: {
        Row: {
          attempt_id: string
          id: string
          model: Json
          updated_at: string
        }
        Insert: {
          attempt_id: string
          id?: string
          model?: Json
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          id?: string
          model?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorm_cmi_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "scorm_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      scorm_packages: {
        Row: {
          created_at: string
          created_by: string | null
          entry_point: string
          id: string
          is_active: boolean
          manifest_json: Json
          storage_prefix: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_point: string
          id?: string
          is_active?: boolean
          manifest_json?: Json
          storage_prefix: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_point?: string
          id?: string
          is_active?: boolean
          manifest_json?: Json
          storage_prefix?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      scorm_scos: {
        Row: {
          created_at: string
          data_from_lms: string | null
          id: string
          identifier: string
          launch_href: string
          mastery_score: string | null
          package_id: string
          prerequisites: string | null
          title: string
        }
        Insert: {
          created_at?: string
          data_from_lms?: string | null
          id?: string
          identifier: string
          launch_href: string
          mastery_score?: string | null
          package_id: string
          prerequisites?: string | null
          title: string
        }
        Update: {
          created_at?: string
          data_from_lms?: string | null
          id?: string
          identifier?: string
          launch_href?: string
          mastery_score?: string | null
          package_id?: string
          prerequisites?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorm_scos_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "scorm_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      test_assignments: {
        Row: {
          assigned_by: string | null
          assigned_via: string
          created_at: string
          id: string
          is_active: boolean
          question_count: number
          source_file_name: string | null
          source_unit: string | null
          test_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_via?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_count: number
          source_file_name?: string | null
          source_unit?: string | null
          test_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_via?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_count?: number
          source_file_name?: string | null
          source_unit?: string | null
          test_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_assignments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_retake_permissions: {
        Row: {
          granted_at: string | null
          granted_by: string
          id: string
          reason: string | null
          test_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by: string
          id?: string
          reason?: string | null
          test_id: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string
          id?: string
          reason?: string | null
          test_id?: string
          user_id?: string
        }
        Relationships: []
      }
      test_submissions: {
        Row: {
          assignment_id: string | null
          answers: Json | null
          auto_submit: boolean | null
          created_at: string | null
          end_time: string | null
          id: string
          passed: boolean | null
          question_ids: string[] | null
          score: number | null
          start_time: string | null
          status: string | null
          test_id: string | null
          total_points: number | null
          unit: string | null
          user_id: string | null
          violations: Json[] | null
          violations_count: number | null
        }
        Insert: {
          assignment_id?: string | null
          answers?: Json | null
          auto_submit?: boolean | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          passed?: boolean | null
          question_ids?: string[] | null
          score?: number | null
          start_time?: string | null
          status?: string | null
          test_id?: string | null
          total_points?: number | null
          unit?: string | null
          user_id?: string | null
          violations?: Json[] | null
          violations_count?: number | null
        }
        Update: {
          assignment_id?: string | null
          answers?: Json | null
          auto_submit?: boolean | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          passed?: boolean | null
          question_ids?: string[] | null
          score?: number | null
          start_time?: string | null
          status?: string | null
          test_id?: string | null
          total_points?: number | null
          unit?: string | null
          user_id?: string | null
          violations?: Json[] | null
          violations_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "test_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number
          groups: string[] | null
          id: string
          is_active: boolean | null
          passing_percentage: number
          question_ids: string[]
          results_released: boolean | null
          test_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes: number
          groups?: string[] | null
          id?: string
          is_active?: boolean | null
          passing_percentage: number
          question_ids: string[]
          results_released?: boolean | null
          test_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          groups?: string[] | null
          id?: string
          is_active?: boolean | null
          passing_percentage?: number
          question_ids?: string[]
          results_released?: boolean | null
          test_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tutorial_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tutorial_quiz_attempts: {
        Row: {
          answers: Json
          category_breakdown: Json | null
          correct_answers: number
          created_at: string | null
          id: string
          score: number
          time_spent_seconds: number
          total_questions: number
          tutorial_id: string
          user_id: string
        }
        Insert: {
          answers: Json
          category_breakdown?: Json | null
          correct_answers: number
          created_at?: string | null
          id?: string
          score: number
          time_spent_seconds: number
          total_questions: number
          tutorial_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          category_breakdown?: Json | null
          correct_answers?: number
          created_at?: string | null
          id?: string
          score?: number
          time_spent_seconds?: number
          total_questions?: number
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_quiz_attempts_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          created_by: string
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          tutorial_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          created_by: string
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          tutorial_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          created_by?: string
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          tutorial_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_quiz_questions_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
          video_type: string | null
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
          video_type?: string | null
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
          video_type?: string | null
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tutorial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: number
          role: string
          user_id: string
        }
        Insert: {
          id?: never
          role: string
          user_id: string
        }
        Update: {
          id?: never
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          assigned_test_type: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          location: string | null
          role: string | null
          unit: string | null
          updated_at: string | null
          user_group: string | null
          verified: boolean | null
        }
        Insert: {
          assigned_test_type?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          location?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string | null
          user_group?: string | null
          verified?: boolean | null
        }
        Update: {
          assigned_test_type?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          location?: string | null
          role?: string | null
          unit?: string | null
          updated_at?: string | null
          user_group?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      v_candidate_scores: {
        Row: {
          correct_answers: number | null
          id: string | null
          score_2dp: number | null
          time_spent_seconds: number | null
          total_questions: number | null
          tutorial_id: string | null
          user_id: string | null
        }
        Insert: {
          correct_answers?: number | null
          id?: string | null
          score_2dp?: never
          time_spent_seconds?: number | null
          total_questions?: number | null
          tutorial_id?: string | null
          user_id?: string | null
        }
        Update: {
          correct_answers?: number | null
          id?: string | null
          score_2dp?: never
          time_spent_seconds?: number | null
          total_questions?: number | null
          tutorial_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_quiz_attempts_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_cert_metrics: {
        Row: {
          course_id: string | null
          downloaded_count: number | null
          issued_count: number | null
          title: string | null
        }
        Relationships: []
      }
      vw_course_progress: {
        Row: {
          course_id: string | null
          percent_complete: number | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_enrollment_progress: {
        Row: {
          completed_required: number | null
          completed_total: number | null
          course_description: string | null
          course_id: string | null
          course_thumbnail_url: string | null
          course_title: string | null
          enrolled_at: string | null
          enrollment_id: string | null
          percent_complete: number | null
          required_modules: number | null
          total_modules: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_cert_metrics"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "vw_course_progress"
            referencedColumns: ["course_id"]
          },
        ]
      }
    }
    Functions: {
      get_user_profile_data: {
        Args: { field_name: string; user_uuid: string }
        Returns: string
      }
      get_user_role: { Args: { user_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      lesson_kind: "video" | "reading" | "quiz" | "external" | "scorm"
      lesson_type: "video" | "reading" | "quiz" | "external" | "scorm"
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
      lesson_kind: ["video", "reading", "quiz", "external", "scorm"],
      lesson_type: ["video", "reading", "quiz", "external", "scorm"],
    },
  },
} as const
