import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster, FullQuestionnaire, SectionWithQuestions, QuestionWithWeights } from "./types";

export async function fetchClusters(): Promise<CareerCluster[]> {
  const { data, error } = await supabase
    .from("career_clusters").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as CareerCluster[];
}

export async function fetchFullQuestionnaire(id: string): Promise<FullQuestionnaire | null> {
  const { data: q, error } = await supabase
    .from("questionnaires").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!q) return null;

  const { data: secs } = await supabase
    .from("sections").select("*").eq("questionnaire_id", id).order("order_index");

  const sectionIds = (secs ?? []).map((s) => s.id);
  const { data: qs } = sectionIds.length
    ? await supabase.from("questions").select("*").in("section_id", sectionIds).order("order_index")
    : { data: [] as any[] };

  const questionIds = (qs ?? []).map((x) => x.id);
  const { data: weights } = questionIds.length
    ? await supabase.from("answer_weights").select("*").in("question_id", questionIds)
    : { data: [] as any[] };

  const weightMap: Record<string, Record<string, number>> = {};
  (weights ?? []).forEach((w: any) => {
    weightMap[w.question_id] = weightMap[w.question_id] || {};
    weightMap[w.question_id][w.career_cluster_id] = w.weight;
  });

  const sections: SectionWithQuestions[] = (secs ?? []).map((s: any) => ({
    ...s,
    questions: (qs ?? [])
      .filter((qq: any) => qq.section_id === s.id)
      .map<QuestionWithWeights>((qq: any) => ({ ...qq, weights: weightMap[qq.id] ?? {} })),
  }));

  return { ...(q as any), sections };
}

export async function createBlankQuestionnaire(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("questionnaires")
    .insert({ created_by: userId, title: "Untitled Questionnaire", description: "" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}
