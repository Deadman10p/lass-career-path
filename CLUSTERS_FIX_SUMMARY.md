# Clusters Not Showing After Import - Debugging Summary

## Problem
After importing JSON with weights, clusters are created in the database but don't appear on the frontend Clusters tab.

## Root Cause Analysis

### 1. Database Schema Check
The `career_clusters` table has a `questionnaire_id` column (nullable) that makes clusters specific to each questionnaire.
The `questionnaire_clusters` junction table links clusters to questionnaires.

### 2. Frontend Flow
1. ImportDialog creates clusters with `questionnaire_id` set
2. ImportDialog creates junction entries in `questionnaire_clusters`
3. ImportDialog calls `onImported()` which triggers `reload()`
4. `reload()` calls `fetchClusters(id)` 
5. `fetchClusters` queries the junction table and then fetches cluster details

### 3. Debug Logging Added
I've added console logging to track:
- Cluster creation in ImportDialog
- Junction table inserts
- fetchClusters query results
- reload() function results

## SQL to Run in Supabase SQL Editor

Run this migration to add CASCADE deletes (fixes delete button issue):

```sql
-- Add CASCADE delete to all foreign keys related to questionnaires
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
```

## Testing Steps

1. Open browser DevTools Console (F12)
2. Go to a questionnaire editor
3. Click Import → Paste JSON → Parse
4. Use this test JSON:
```json
{
  "sections": [
    {
      "title": "Test Section",
      "questions": [
        {"statement": "I like math", "weights": {"STEM": 5}},
        {"statement": "I like art", "weights": {"Creative": 4}}
      ]
    }
  ]
}
```
5. Click Import
6. Watch console logs for:
   - "Created cluster: STEM with ID: ..."
   - "Created cluster: Creative with ID: ..."
7. Go to Clusters tab
8. Check console for:
   - "Reloading questionnaire: ..."
   - "Junction data for questionnaire ... : [...]"
   - "Loaded clusters: [...]"

## Expected Results
- Console should show clusters being created
- Console should show junction entries being created  
- Console should show clusters being fetched
- Clusters tab should display the newly created clusters

## If Still Not Working
Check these in order:
1. Browser console shows any errors?
2. Browser console shows "Created cluster" messages?
3. Browser console shows junction data (should be array with entries)?
4. In Supabase Table Editor, check `questionnaire_clusters` table has entries
5. In Supabase Table Editor, check `career_clusters` table has entries with correct `questionnaire_id`
6. Check RLS policies allow reading the clusters

