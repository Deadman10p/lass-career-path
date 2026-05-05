
ALTER TABLE public.career_clusters ADD COLUMN IF NOT EXISTS profile_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.questionnaires ADD COLUMN IF NOT EXISTS profile_schema JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.response_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL UNIQUE,
  student_id UUID NOT NULL,
  questionnaire_id UUID NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.response_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own insights"
  ON public.response_insights FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'setter'::app_role));

CREATE POLICY "Setters manage insights"
  ON public.response_insights FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'setter'::app_role))
  WITH CHECK (has_role(auth.uid(), 'setter'::app_role));

CREATE TABLE IF NOT EXISTS public.general_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  inventories_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.general_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own general profile"
  ON public.general_profiles FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'setter'::app_role));

CREATE POLICY "Setters manage general profile"
  ON public.general_profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'setter'::app_role))
  WITH CHECK (has_role(auth.uid(), 'setter'::app_role));

CREATE TRIGGER set_response_insights_updated_at
  BEFORE UPDATE ON public.response_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_general_profiles_updated_at
  BEFORE UPDATE ON public.general_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
