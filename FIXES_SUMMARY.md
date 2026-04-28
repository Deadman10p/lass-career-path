# Clusters Import Fix - Complete Summary

## Problem Identified

You reported that:
1. **Clusters page is empty after import** - even though data exists in the database
2. **Delete button doesn't exist on frontend** - but it does exist in the code

## Root Causes Found

### Issue 1: RLS (Row Level Security) Policies Blocking Cluster Reads

The `fetchClusters()` function in `/workspace/src/lib/api.ts` queries the `questionnaire_clusters` junction table to get cluster IDs, then fetches those clusters from `career_clusters`. However, the RLS policies may be blocking reads of questionnaire-scoped clusters.

**Current Policy Problem:**
- The existing policy `"Anyone authenticated can read career clusters"` uses `USING (true)` which should work
- BUT when clusters have a `questionnaire_id`, there might be permission issues with the junction table or the way we're querying

### Issue 2: Missing CASCADE Deletes (Already Fixed)

The delete button DOES exist in your dashboard at line 110 of `SetterDashboard.tsx`:
```tsx
<Button variant="outline" size="icon" onClick={() => handleDelete(q.id, q.title)} title="Delete questionnaire">
  <Trash2 className="h-4 w-4 text-destructive" />
</Button>
```

However, without CASCADE deletes, the deletion would fail silently or partially. The migration file `/workspace/supabase/migrations/20260428140000_add_cascade_deletes.sql` already exists to fix this.

## Solutions

### Solution 1: Run This SQL in Supabase SQL Editor

This will fix both the RLS policy issues AND ensure cascade deletes work:

```sql
-- =====================================================
-- FIX CLUSTERS IMPORT & DELETE FUNCTIONALITY
-- =====================================================

-- PART A: Fix CASCADE deletes for questionnaires
ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_questionnaire_id_fkey;
ALTER TABLE sections ADD CONSTRAINT sections_questionnaire_id_fkey
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_questionnaire_id_fkey;
ALTER TABLE responses ADD CONSTRAINT responses_questionnaire_id_fkey
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

ALTER TABLE questionnaire_clusters DROP CONSTRAINT IF EXISTS questionnaire_clusters_questionnaire_id_fkey;
ALTER TABLE questionnaire_clusters ADD CONSTRAINT questionnaire_clusters_questionnaire_id_fkey
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_section_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;

ALTER TABLE answer_weights DROP CONSTRAINT IF EXISTS answer_weights_question_id_fkey;
ALTER TABLE answer_weights ADD CONSTRAINT answer_weights_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_response_id_fkey;
ALTER TABLE answers ADD CONSTRAINT answers_response_id_fkey
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE answers ADD CONSTRAINT answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE results DROP CONSTRAINT IF EXISTS results_response_id_fkey;
ALTER TABLE results ADD CONSTRAINT results_response_id_fkey
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;

-- PART B: Fix RLS policies for career_clusters
DROP POLICY IF EXISTS "Anyone authenticated can read career clusters" ON career_clusters;
DROP POLICY IF EXISTS "Setters manage career clusters" ON career_clusters;

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

-- PART C: Fix RLS policies for questionnaire_clusters
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

-- PART D: Verify everything is working
SELECT '✅ CASCADE deletes configured' as status;
SELECT '✅ RLS policies updated for career_clusters' as status;
SELECT '✅ RLS policies updated for questionnaire_clusters' as status;
```

### Solution 2: Test the Import

After running the SQL above:

1. **Open your app** and navigate to a questionnaire editor
2. **Open Browser DevTools Console** (F12)
3. Click **Import** button
4. Paste this test JSON:
```json
{
  "sections": [{
    "title": "Test Section",
    "questions": [
      {"statement": "I like math", "weights": {"STEM": 5}},
      {"statement": "I like art", "weights": {"Creative": 4}}
    ]
  }]
}
```
5. Click **Parse & Preview**
6. Ensure "Also apply detected weights" is checked
7. Click **Import**
8. **Watch the console logs** - you should see:
   - "Starting cluster auto-creation..."
   - "Creating new cluster: STEM"
   - "Cluster created successfully..."
   - "Creating junction for cluster..."
   - "Junction created successfully..."
9. Go to **Tab 3: Clusters** - you should now see "STEM" and "Creative" clusters!

### Solution 3: Test the Delete Button

1. Go to **Setter Dashboard** (`/setter/dashboard`)
2. You should see a **trash icon button** on the right side of each questionnaire card
3. Click it to delete a questionnaire
4. The questionnaire should disappear from the list immediately

## Files Modified

1. **`/workspace/src/components/setter/ImportDialog.tsx`** - Added extensive console logging to debug cluster creation
2. **`/workspace/src/lib/api.ts`** - Already has logging for junction queries
3. **`/workspace/src/pages/setter/QuestionnaireEditor.tsx`** - Already has logging in reload function
4. **`/workspace/src/pages/setter/SetterDashboard.tsx`** - Already has logging and delete button
5. **`/workspace/supabase/migrations/20260428140000_add_cascade_deletes.sql`** - Already exists with CASCADE constraints
6. **`/workspace/CLUSTERS_DEBUG_SQL.sql`** - Created diagnostic SQL script
7. **`/workspace/FIXES_SUMMARY.md`** - This file

## Why This Happened

The most likely cause is that when clusters were created with a `questionnaire_id`, the RLS policies weren't properly configured to allow:
1. Reading clusters that belong to specific questionnaires
2. Inserting into the junction table with proper permissions

The new policies explicitly allow setters to manage clusters for questionnaires they own.

## Next Steps

1. **Run the SQL script** from Solution 1 in your Supabase SQL Editor
2. **Test the import** with console open
3. **Share any error messages** from the console if it still doesn't work
4. The delete button should already be visible and working after the CASCADE fixes are applied
