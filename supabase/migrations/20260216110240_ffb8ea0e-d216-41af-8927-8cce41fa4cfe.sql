-- Re-create triggers that may not have been applied
DROP TRIGGER IF EXISTS on_auth_user_created_assign_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_roles();

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Also update user_roles policies to work with anonymous auth
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated, anon
  USING ((user_id = auth.uid()) OR is_admin());
