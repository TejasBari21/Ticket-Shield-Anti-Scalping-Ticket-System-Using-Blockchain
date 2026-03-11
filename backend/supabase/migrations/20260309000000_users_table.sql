-- ============================================================
-- Users table: stores user profile data linked to Supabase Auth
-- Run with: supabase db push
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  wallet_address TEXT,
  role           TEXT        NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY "users_owner_select"
  ON public.users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own record (e.g. to set wallet_address)
CREATE POLICY "users_owner_update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can insert their own record (immediately after signup)
CREATE POLICY "users_owner_insert"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all user records.
-- Uses a security-definer helper to avoid recursive RLS checks.
CREATE OR REPLACE FUNCTION public.current_user_role()
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "users_admin_select_all"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');
