import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster, FullQuestionnaire, SectionWithQuestions, QuestionWithWeights } from "./types";

export async function fetchClusters(questionnaireId?: string): Promise<CareerCluster[]> {
  let query = supabase.from("career_clusters").select("*");

  if (questionnaireId) {
    const { data: qcData, error: qcError } = await supabase
      .from("questionnaire_clusters")
      .select("career_cluster_id")
      .eq("questionnaire_id", questionnaireId);

    if (qcError) throw qcError;

    if (qcData && qcData.length > 0) {
      const clusterIds = qcData.map(qc => qc.career_cluster_id);
      query = query.in("id", clusterIds);
    } else {
      return [];
    }
  }

  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data ?? []) as unknown as CareerCluster[];
}

export async function fetchAllClusters(): Promise<CareerCluster[]> {
  const { data, error } = await supabase
    .from("career_clusters")
    .select("*")
    .is("questionnaire_id", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as CareerCluster[];
}

/**
 * Returns the set of cluster ids that actually have a non-zero weight on at
 * least one question of the given questionnaire. Used to hide "ghost"
 * categories (clusters that exist on the questionnaire but were never wired up
 * to any question) from results / charts.
 */
export async function fetchActiveClusterIdsForQuestionnaire(
  questionnaireId: string,
): Promise<Set<string>> {
  const { data: secs } = await supabase
    .from("sections").select("id").eq("questionnaire_id", questionnaireId);
  const sIds = (secs ?? []).map((s: any) => s.id);
  if (!sIds.length) return new Set();
  const { data: qs } = await supabase.from("questions").select("id").in("section_id", sIds);
  const qIds = (qs ?? []).map((x: any) => x.id);
  if (!qIds.length) return new Set();
  const { data: ws } = await supabase
    .from("answer_weights")
    .select("career_cluster_id, weight")
    .in("question_id", qIds)
    .gt("weight", 0);
  return new Set((ws ?? []).map((w: any) => w.career_cluster_id));
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
