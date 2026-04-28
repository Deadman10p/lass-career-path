
-- Make career_clusters scoped per questionnaire (nullable = legacy/global pool, used as templates)
ALTER TABLE public.career_clusters
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid;

CREATE INDEX IF NOT EXISTS idx_career_clusters_questionnaire ON public.career_clusters(questionnaire_id);

-- Add color column alias if missing (used by RPC)
-- (skip: existing column is color_hex)

-- RLS already allows setters to manage; no policy change needed.
