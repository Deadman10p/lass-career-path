
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('setter', 'student');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL DEFAULT '',
  class_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role helper (security definer, avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_role helper
CREATE OR REPLACE FUNCTION public.get_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Setters can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'setter'));

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, full_name, class_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'class_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Career clusters
CREATE TABLE public.career_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_emoji TEXT NOT NULL DEFAULT '✨',
  possible_careers TEXT[] NOT NULL DEFAULT '{}',
  color_hex TEXT NOT NULL DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.career_clusters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clusters_updated BEFORE UPDATE ON public.career_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Anyone authenticated can read career clusters"
  ON public.career_clusters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Setters manage career clusters"
  ON public.career_clusters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Questionnaires
CREATE TABLE public.questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Questionnaire',
  description TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_q_updated BEFORE UPDATE ON public.questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Students can view published questionnaires"
  ON public.questionnaires FOR SELECT TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'setter'));
CREATE POLICY "Setters manage questionnaires"
  ON public.questionnaires FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Sections
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Section',
  description TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.sections(questionnaire_id);

CREATE POLICY "Anyone authenticated can view sections of accessible questionnaires"
  ON public.sections FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questionnaires q
    WHERE q.id = questionnaire_id
      AND (q.is_published = true OR public.has_role(auth.uid(), 'setter'))
  ));
CREATE POLICY "Setters manage sections"
  ON public.sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  statement TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.questions(section_id);

CREATE POLICY "Anyone authenticated can view questions of accessible questionnaires"
  ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.questionnaires q ON q.id = s.questionnaire_id
    WHERE s.id = section_id
      AND (q.is_published = true OR public.has_role(auth.uid(), 'setter'))
  ));
CREATE POLICY "Setters manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Answer weights
CREATE TABLE public.answer_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  career_cluster_id UUID NOT NULL REFERENCES public.career_clusters(id) ON DELETE CASCADE,
  weight INT NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 5),
  UNIQUE (question_id, career_cluster_id)
);
ALTER TABLE public.answer_weights ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.answer_weights(question_id);

CREATE POLICY "Authenticated can read weights"
  ON public.answer_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Setters manage weights"
  ON public.answer_weights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'setter'))
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

-- Responses
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.responses(student_id);
CREATE INDEX ON public.responses(questionnaire_id);

CREATE POLICY "Students view their own responses"
  ON public.responses FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'setter'));
CREATE POLICY "Students insert their own responses"
  ON public.responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Answers
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5)
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.answers(response_id);

CREATE POLICY "View answers via response ownership"
  ON public.answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.id = response_id
      AND (r.student_id = auth.uid() OR public.has_role(auth.uid(), 'setter'))
  ));
CREATE POLICY "Insert answers for own response"
  ON public.answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.id = response_id AND r.student_id = auth.uid()
  ));

-- Results
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  career_cluster_id UUID NOT NULL REFERENCES public.career_clusters(id) ON DELETE CASCADE,
  total_score INT NOT NULL DEFAULT 0,
  UNIQUE (response_id, career_cluster_id)
);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.results(response_id);

CREATE POLICY "View results via response ownership"
  ON public.results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.id = response_id
      AND (r.student_id = auth.uid() OR public.has_role(auth.uid(), 'setter'))
  ));
CREATE POLICY "Insert results for own response"
  ON public.results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.id = response_id AND r.student_id = auth.uid()
  ));

-- Seed the 6 default career clusters
INSERT INTO public.career_clusters (name, description, icon_emoji, possible_careers, color_hex) VALUES
  ('Science & Engineering', 'Analytical thinkers who love to investigate, experiment, and solve technical problems.', '🔬', ARRAY['Engineer','Research Scientist','Doctor','Architect','Mathematician','Biotechnologist'], '#4F46E5'),
  ('Helping & People', 'Empathetic people who thrive on supporting, teaching, and caring for others.', '🤝', ARRAY['Teacher','Counsellor','Nurse','Social Worker','Psychologist','Therapist'], '#0D9488'),
  ('Practical & Hands-on', 'Doers who enjoy building, fixing, and working with tools or the outdoors.', '🛠️', ARRAY['Mechanic','Chef','Farmer','Electrician','Carpenter','Pilot'], '#F59E0B'),
  ('Creative & Expressive', 'Imaginative people who communicate through art, words, music, or design.', '🎨', ARRAY['Designer','Writer','Filmmaker','Musician','Artist','Photographer'], '#EC4899'),
  ('Leadership & Communication', 'Confident communicators who lead teams, persuade, and organise people.', '🎤', ARRAY['Lawyer','Manager','Diplomat','Entrepreneur','Politician','Journalist'], '#7C3AED'),
  ('Technology & Innovation', 'Digital natives drawn to coding, systems, and emerging tech.', '💻', ARRAY['Software Engineer','Data Scientist','AI Researcher','Cybersecurity Analyst','Game Developer','Product Manager'], '#06B6D4');
