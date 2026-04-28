-- =====================================================
-- CLUSTERS DEBUG & FIX SQL SCRIPT
-- Run this in your Supabase SQL Editor to diagnose 
-- and fix the cluster import issues
-- =====================================================

-- 1. CHECK IF TABLES EXIST AND HAVE DATA
SELECT 'career_clusters count:' as table_name, COUNT(*) as count FROM career_clusters
UNION ALL
SELECT 'questionnaire_clusters count:', COUNT(*) FROM questionnaire_clusters
UNION ALL
SELECT 'questionnaires count:', COUNT(*) FROM questionnaires;

-- 2. CHECK RLS POLICIES ON career_clusters
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'career_clusters';

-- 3. CHECK RLS POLICIES ON questionnaire_clusters  
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'questionnaire_clusters';

-- 4. TEST QUERY - What fetchClusters() does
-- Replace YOUR_QUESTIONNAIRE_ID with an actual ID from your database
-- SELECT qc.career_cluster_id, cc.*
-- FROM questionnaire_clusters qc
-- JOIN career_clusters cc ON cc.id = qc.career_cluster_id
-- WHERE qc.questionnaire_id = 'YOUR_QUESTIONNAIRE_ID'::uuid;

-- 5. FIX: Update RLS policies to allow setters to manage questionnaire-scoped clusters
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone authenticated can read career clusters" ON career_clusters;
DROP POLICY IF EXISTS "Setters manage career clusters" ON career_clusters;

-- Create new policies that allow reading ALL clusters but only managing your own
CREATE POLICY "Anyone authenticated can read career clusters"
  ON career_clusters FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Setters can insert clusters"
  ON career_clusters FOR INSERT 
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'setter'));

CREATE POLICY "Setters can update their own clusters"
  ON career_clusters FOR UPDATE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'setter') 
    AND (questionnaire_id IS NULL OR questionnaire_id IN (
      SELECT id FROM questionnaires WHERE created_by = auth.uid()
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'setter')
    AND (questionnaire_id IS NULL OR questionnaire_id IN (
      SELECT id FROM questionnaires WHERE created_by = auth.uid()
    ))
  );

CREATE POLICY "Setters can delete their own clusters"
  ON career_clusters FOR DELETE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'setter')
    AND (questionnaire_id IS NULL OR questionnaire_id IN (
      SELECT id FROM questionnaires WHERE created_by = auth.uid()
    ))
  );

-- 6. FIX: Ensure questionnaire_clusters has proper RLS
DROP POLICY IF EXISTS "Anyone authenticated can read questionnaire clusters" ON questionnaire_clusters;
DROP POLICY IF EXISTS "Setters manage questionnaire clusters" ON questionnaire_clusters;

CREATE POLICY "Anyone authenticated can read questionnaire clusters"
  ON questionnaire_clusters FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Setters can insert questionnaire clusters"
  ON questionnaire_clusters FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'setter')
    AND questionnaire_id IN (
      SELECT id FROM questionnaires WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Setters can delete questionnaire clusters"
  ON questionnaire_clusters FOR DELETE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'setter')
    AND questionnaire_id IN (
      SELECT id FROM questionnaires WHERE created_by = auth.uid()
    )
  );

-- 7. VERIFY THE FIXES
SELECT 'Updated policies for career_clusters' as status;
SELECT 'Updated policies for questionnaire_clusters' as status;

-- 8. MANUAL TEST: Create a test cluster and junction (optional)
-- Uncomment and replace YOUR_QUESTIONNAIRE_ID to test
-- DO $$
-- DECLARE
--   test_qid UUID := 'YOUR_QUESTIONNAIRE_ID'::uuid;
--   test_cid UUID;
-- BEGIN
--   -- Insert a test cluster
--   INSERT INTO career_clusters (name, description, icon_emoji, possible_careers, color_hex, questionnaire_id)
--   VALUES ('Test Import Cluster', 'Created via SQL test', '🧪', ARRAY['Tester'], '#FF0000', test_qid)
--   RETURNING id INTO test_cid;
--   
--   -- Insert junction
--   INSERT INTO questionnaire_clusters (questionnaire_id, career_cluster_id)
--   VALUES (test_qid, test_cid);
--   
--   RAISE NOTICE 'Test cluster created with ID: %', test_cid;
-- END $$;
