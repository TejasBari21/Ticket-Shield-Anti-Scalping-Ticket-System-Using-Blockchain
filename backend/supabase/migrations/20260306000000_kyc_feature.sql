-- ============================================================
-- Feature 3: Identity-Linked KYC Verification
-- Run this migration in Supabase SQL editor or via CLI:
--   supabase db push
-- ============================================================

-- 1. Add kyc_status column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified', 'pending', 'approved', 'rejected'));

-- 2. Add kyc_required flag to events (opt-in per event)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kyc_required BOOLEAN NOT NULL DEFAULT false;

-- 3. KYC submissions table
--    Sensitive ID numbers are NEVER stored — only a SHA-256 hash stored client-side.
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address   TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  country          TEXT NOT NULL,
  id_type          TEXT NOT NULL
    CHECK (id_type IN ('passport', 'drivers_license', 'national_id')),
  -- SHA-256 hex of the upper-cased, trimmed ID number (client-computed)
  id_number_hash   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES auth.users(id)
);

-- 4. Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status  ON public.kyc_submissions(status);

-- 5. Row Level Security
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Owners can see their own submissions
CREATE POLICY "kyc_owner_select"
  ON public.kyc_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owners can insert their own submission
CREATE POLICY "kyc_owner_insert"
  ON public.kyc_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all (app-layer role check keeps non-admins out of the UI)
CREATE POLICY "kyc_admin_select_all"
  ON public.kyc_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update status / rejection_reason
CREATE POLICY "kyc_admin_update"
  ON public.kyc_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
