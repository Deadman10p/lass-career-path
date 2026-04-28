-- Add CASCADE delete to all foreign keys related to questionnaires
-- This ensures that when a questionnaire is deleted, all related data is also deleted
-- Run this in your Supabase SQL Editor

-- Sections cascade
ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_questionnaire_id_fkey;
ALTER TABLE sections ADD CONSTRAINT sections_questionnaire_id_fkey 
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

-- Responses cascade
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_questionnaire_id_fkey;
ALTER TABLE responses ADD CONSTRAINT responses_questionnaire_id_fkey 
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

-- Questionnaire clusters junction cascade
ALTER TABLE questionnaire_clusters DROP CONSTRAINT IF EXISTS questionnaire_clusters_questionnaire_id_fkey;
ALTER TABLE questionnaire_clusters ADD CONSTRAINT questionnaire_clusters_questionnaire_id_fkey 
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

-- Questions cascade through sections
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_section_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_section_id_fkey 
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

-- Answer weights cascade through questions
ALTER TABLE answer_weights DROP CONSTRAINT IF EXISTS answer_weights_question_id_fkey;
ALTER TABLE answer_weights ADD CONSTRAINT answer_weights_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- Answers cascade through responses and questions
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_response_id_fkey;
ALTER TABLE answers ADD CONSTRAINT answers_response_id_fkey 
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE answers ADD CONSTRAINT answers_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- Results cascade through responses
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_response_id_fkey;
ALTER TABLE results ADD CONSTRAINT results_response_id_fkey 
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;
