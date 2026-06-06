-- Lock down SECURITY DEFINER helpers: revoke from PUBLIC/anon; grant only what's needed.

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_questionnaire_clusters(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_clusters(uuid) TO authenticated, service_role;

-- Trigger functions: not meant to be called by clients
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;