-- Allow profiles to be upserted by their owner (needed for anonymous auth flow)
-- The existing INSERT policy requires user_id = auth.uid(), which is correct
-- But we need to handle the case where the trigger already created the profile
-- by allowing upsert (the UPDATE policy already allows owner updates)

-- Also ensure the handle_new_user_profile function handles anonymous users
-- who may not have email with wallet address
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, wallet_address, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'wallet_address',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'unknown'
    ),
    COALESCE(
      concat(left(NEW.raw_user_meta_data->>'wallet_address', 6), '...', right(NEW.raw_user_meta_data->>'wallet_address', 4)),
      'User'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate profiles insert policy to also allow the service role / trigger
-- Keep existing policy name
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (user_id = auth.uid());
