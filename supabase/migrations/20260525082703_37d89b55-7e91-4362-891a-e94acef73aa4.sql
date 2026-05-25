ALTER TABLE public.questionnaires
  ADD COLUMN IF NOT EXISTS report_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS synthesis_style text NOT NULL DEFAULT '';