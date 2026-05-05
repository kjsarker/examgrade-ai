export type Plan = 'free' | 'pro' | 'premium'
export type DifficultyMode = 'easy' | 'medium' | 'hard'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type UploadType = 'question_paper' | 'sample_answer' | 'student_script'

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  plan: Plan
  papers_used: number
  papers_limit: number
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status?: string
  created_at: string
  updated_at: string
}

export interface GradingJob {
  id: string
  user_id: string
  title: string
  status: JobStatus
  difficulty_mode: DifficultyMode
  total_papers: number
  processed_papers: number
  failed_papers: number
  question_paper_url?: string
  sample_answer_url?: string
  csv_report_url?: string
  pdf_report_url?: string
  error_message?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface QuestionBreakdown {
  question: string
  score: number
  max_score: number
  feedback: string
}

export interface GradingResult {
  id: string
  job_id: string
  user_id: string
  student_id?: string
  student_name: string
  total_score: number
  max_score: number
  percentage?: number
  grade?: string
  question_breakdown?: QuestionBreakdown[]
  overall_feedback?: string
  created_at: string
}

export interface AIGradingResponse {
  student_id: string
  student_name: string
  total_score: number
  max_score: number
  question_wise_breakdown: QuestionBreakdown[]
  overall_feedback: string
}

export interface GradingSettings {
  id: string
  user_id: string
  difficulty_mode: DifficultyMode
  custom_prompt_override?: string
  use_custom_prompt: boolean
  updated_at: string
}

export interface PlanFeatures {
  name: string
  price: number
  papers_per_month: number
  features: string[]
  stripe_price_id?: string
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    name: 'Trial',
    price: 0,
    papers_per_month: 5,
    features: [
      '5 papers lifetime',
      'Basic grading speed',
      'Standard AI accuracy',
      'CSV export only',
      '1 grading job at a time',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49.99,
    papers_per_month: 200,
    features: [
      '200 papers/month',
      'Standard processing speed',
      'PDF + CSV export',
      'Custom grading prompts',
      'Email reports',
      'Multiple grading jobs',
    ],
  },
  premium: {
    name: 'Premium',
    price: 99.99,
    papers_per_month: 500,
    features: [
      '500 papers/month',
      'Fast priority queue',
      'Advanced analytics',
      'Multi-course management',
      'Team/TA access',
      'Everything in Pro',
    ],
  },
}
