-- Add stream column to profiles for student stream filtering
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stream text;

-- Update handle_new_user to capture stream from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, role, full_name, class_name, stream)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'class_name',
    NEW.raw_user_meta_data->>'stream'
  );
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clear all student/setter data so we can start fresh
DELETE FROM public.results;
DELETE FROM public.answers;
DELETE FROM public.responses;
DELETE FROM public.profiles;
DELETE FROM auth.users;