CREATE OR REPLACE FUNCTION public.get_questionnaire_clusters(q_id uuid)
 RETURNS TABLE(id uuid, name text, description text, icon text, color text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.description,
    cc.icon_emoji,
    cc.color_hex
  FROM public.career_clusters cc
  JOIN public.questionnaire_clusters qc ON cc.id = qc.career_cluster_id
  WHERE qc.questionnaire_id = q_id;
END;
$function$;