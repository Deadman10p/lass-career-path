-- Add questionnaire_clusters junction table to link clusters to specific questionnaires
CREATE TABLE public.questionnaire_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  career_cluster_id UUID NOT NULL REFERENCES public.career_clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id, career_cluster_id)
);
ALTER TABLE public.questionnaire_clusters ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.questionnaire_clusters(questionnaire_id);
CREATE INDEX ON public.questionnaire_clusters(career_cluster_id);

-- RLS policies for questionnaire_clusters
CREATE POLICY "Anyone authenticated can read questionnaire clusters"
  ON public.questionnaire_clusters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Setters manage questionnaire clusters"
  ON public.questionnaire_clusters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Helper function to get clusters for a specific questionnaire
CREATE OR REPLACE FUNCTION public.get_questionnaire_clusters(_questionnaire_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  icon_emoji TEXT,
  possible_careers TEXT[],
  color_hex TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.*
  FROM public.career_clusters cc
  JOIN public.questionnaire_clusters qc ON qc.career_cluster_id = cc.id
  WHERE qc.questionnaire_id = _questionnaire_id
  ORDER BY cc.name;
$$;
