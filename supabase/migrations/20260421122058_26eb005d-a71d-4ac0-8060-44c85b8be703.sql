
DO $$
DECLARE
  q_id uuid;
  setter_id uuid;
  sec_a uuid; sec_b uuid; sec_c uuid;
  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid;
  q8 uuid; q9 uuid; q10 uuid; q11 uuid; q12 uuid; q13 uuid; q14 uuid;
  q15 uuid; q16 uuid; q17 uuid; q18 uuid; q19 uuid; q20 uuid;
  cl_sci uuid := 'b5be7aad-dcde-4f65-bcca-3393eaf3e45b'; -- Science & Engineering
  cl_help uuid := '1186a7dd-edf5-4dde-ad0e-1915d48ad3c8'; -- Helping & People
  cl_prac uuid := 'bd6e5db1-ef36-48a8-a30c-b31ac8bda313'; -- Practical & Hands-on
  cl_creat uuid := '5cdb6b88-7db4-4abd-be1e-33f1aa479575'; -- Creative & Expressive
  cl_lead uuid := '79b9ee6b-fa6a-4f7b-b54b-4a3e3341b195'; -- Leadership & Communication
  cl_tech uuid := '044c55a5-d3ac-464e-a2bc-9c8c4873ec0e'; -- Technology & Innovation
BEGIN
  -- Pick an existing setter (or first profile)
  SELECT user_id INTO setter_id FROM public.profiles WHERE role = 'setter' LIMIT 1;
  IF setter_id IS NULL THEN
    SELECT user_id INTO setter_id FROM public.profiles LIMIT 1;
  END IF;
  IF setter_id IS NULL THEN
    RAISE NOTICE 'No profile found, skipping seed';
    RETURN;
  END IF;

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM public.questionnaires WHERE title = 'Light Academy Career Inventory') THEN
    RAISE NOTICE 'Already seeded';
    RETURN;
  END IF;

  INSERT INTO public.questionnaires (title, description, is_published, created_by)
  VALUES (
    'Light Academy Career Inventory',
    'Discover the career clusters that match your interests, strengths and values. Rate each statement honestly from 1 (Strongly Disagree) to 5 (Strongly Agree).',
    true,
    setter_id
  ) RETURNING id INTO q_id;

  INSERT INTO public.sections (questionnaire_id, title, description, order_index)
  VALUES (q_id, 'Section A — Interests', 'What you naturally enjoy doing.', 0) RETURNING id INTO sec_a;
  INSERT INTO public.sections (questionnaire_id, title, description, order_index)
  VALUES (q_id, 'Section B — Strengths', 'What you''re naturally good at.', 1) RETURNING id INTO sec_b;
  INSERT INTO public.sections (questionnaire_id, title, description, order_index)
  VALUES (q_id, 'Section C — Values', 'What matters most to you in a future career.', 2) RETURNING id INTO sec_c;

  -- Section A
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I enjoy solving puzzles, experiments, or working with numbers.', 0) RETURNING id INTO q1;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I like helping people with their problems.', 1) RETURNING id INTO q2;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I enjoy building, fixing, or working with tools.', 2) RETURNING id INTO q3;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I like drawing, writing, designing, or creating things.', 3) RETURNING id INTO q4;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I enjoy leading groups and making decisions.', 4) RETURNING id INTO q5;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I like working with computers, apps, or technology.', 5) RETURNING id INTO q6;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_a, 'I enjoy reading, researching, and finding out new information.', 6) RETURNING id INTO q7;

  -- Section B
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I can explain ideas clearly to others.', 0) RETURNING id INTO q8;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I am good at organising tasks and planning ahead.', 1) RETURNING id INTO q9;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I can stay calm when solving problems.', 2) RETURNING id INTO q10;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I like working with details and accuracy.', 3) RETURNING id INTO q11;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I am comfortable speaking in front of others.', 4) RETURNING id INTO q12;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I am creative and come up with original ideas.', 5) RETURNING id INTO q13;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_b, 'I enjoy teamwork and collaboration.', 6) RETURNING id INTO q14;

  -- Section C
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career where I can help people.', 0) RETURNING id INTO q15;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career that allows me to earn a high income.', 1) RETURNING id INTO q16;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career where I can work independently.', 2) RETURNING id INTO q17;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career with stability and security.', 3) RETURNING id INTO q18;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career where I can travel or see new places.', 4) RETURNING id INTO q19;
  INSERT INTO public.questions (section_id, statement, order_index) VALUES (sec_c, 'I want a career that lets me express myself creatively.', 5) RETURNING id INTO q20;

  -- Weights (question_id, cluster_id, weight)
  INSERT INTO public.answer_weights (question_id, career_cluster_id, weight) VALUES
    -- Section A — Interests (mostly direct mapping per PDF)
    (q1, cl_sci, 5), (q1, cl_tech, 3), (q1, cl_prac, 1),
    (q2, cl_help, 5), (q2, cl_lead, 2),
    (q3, cl_prac, 5), (q3, cl_sci, 2), (q3, cl_creat, 1),
    (q4, cl_creat, 5), (q4, cl_tech, 1),
    (q5, cl_lead, 5), (q5, cl_help, 2),
    (q6, cl_tech, 5), (q6, cl_sci, 2), (q6, cl_creat, 1),
    (q7, cl_sci, 4), (q7, cl_tech, 2), (q7, cl_lead, 1),

    -- Section B — Strengths
    (q8, cl_lead, 4), (q8, cl_help, 3), (q8, cl_creat, 1),
    (q9, cl_lead, 3), (q9, cl_prac, 3), (q9, cl_sci, 2),
    (q10, cl_sci, 3), (q10, cl_help, 3), (q10, cl_prac, 2),
    (q11, cl_sci, 4), (q11, cl_tech, 3), (q11, cl_prac, 2),
    (q12, cl_lead, 5), (q12, cl_creat, 1),
    (q13, cl_creat, 5), (q13, cl_tech, 2),
    (q14, cl_help, 4), (q14, cl_lead, 3), (q14, cl_prac, 1),

    -- Section C — Values
    (q15, cl_help, 5), (q15, cl_lead, 1),
    (q16, cl_lead, 3), (q16, cl_tech, 2), (q16, cl_sci, 1),
    (q17, cl_tech, 4), (q17, cl_creat, 3), (q17, cl_prac, 2),
    (q18, cl_prac, 3), (q18, cl_sci, 2), (q18, cl_help, 2),
    (q19, cl_lead, 2), (q19, cl_help, 2), (q19, cl_creat, 2), (q19, cl_prac, 1),
    (q20, cl_creat, 5), (q20, cl_tech, 1);

  -- Clean up old empty test questionnaires
  DELETE FROM public.questionnaires WHERE title = 'Untitled Questionnaire' AND id NOT IN (SELECT questionnaire_id FROM public.responses);
END $$;
