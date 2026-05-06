// Domain types shared across the app
export type AppRole = "setter" | "student";

export interface CareerCluster {
  id: string;
  name: string;
  description: string;
  icon_emoji: string;
  possible_careers: string[];
  color_hex: string;
  questionnaire_id?: string | null;
  /** Adaptive per-cluster attributes, e.g. { Strengths: "...", Weaknesses: "...", "Growth Tips": "..." } */
  profile_attributes?: Record<string, string>;
  /** Free-form ordered list of metadata cards, e.g. [{label:"Strengths", content:"..."}, ...] */
  profile_data?: any;
}

export interface ProfileDatum { label: string; content: string }

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Optional list of attribute keys this questionnaire uses for adaptive reports */
  profile_schema?: string[];
}

export interface Section {
  id: string;
  questionnaire_id: string;
  title: string;
  description: string;
  order_index: number;
}

export interface Question {
  id: string;
  section_id: string;
  statement: string;
  order_index: number;
}

export interface AnswerWeight {
  id: string;
  question_id: string;
  career_cluster_id: string;
  weight: number;
}

export interface Response {
  id: string;
  student_id: string;
  questionnaire_id: string;
  submitted_at: string;
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  rating: number;
}

export interface Result {
  id: string;
  response_id: string;
  career_cluster_id: string;
  total_score: number;
}

export interface ResponseInsight {
  id: string;
  response_id: string;
  student_id: string;
  questionnaire_id: string;
  /** Per-cluster AI synthesis: { [clusterId]: { [attributeKey]: text } } plus { _overview?: string } */
  summary: {
    overview?: string;
    by_cluster?: Record<string, Record<string, string>>;
  };
  created_at: string;
  updated_at: string;
}

export interface GeneralProfile {
  id: string;
  student_id: string;
  inventories_count: number;
  summary: {
    strengths?: string[];
    weaknesses?: string[];
    growth?: string[];
    alignments?: string[];
    inventories?: { questionnaire_id: string; title: string; top_cluster: string; submitted_at: string }[];
  };
  created_at: string;
  updated_at: string;
}

// Composite shapes for the editor and student flow
export interface QuestionWithWeights extends Question {
  weights: Record<string, number>; // cluster_id -> weight 0..5
}

export interface SectionWithQuestions extends Section {
  questions: QuestionWithWeights[];
}

export interface FullQuestionnaire extends Questionnaire {
  sections: SectionWithQuestions[];
}
