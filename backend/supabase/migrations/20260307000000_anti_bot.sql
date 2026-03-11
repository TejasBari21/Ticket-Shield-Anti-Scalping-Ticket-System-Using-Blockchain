-- ============================================================
-- Anti-Bot: Purchase Attempt Tracking
-- ============================================================

-- Track every purchase attempt per wallet for rate-limiting and audit.
CREATE TABLE IF NOT EXISTS public.purchase_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet        TEXT        NOT NULL,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      UUID,
  tier_id       UUID,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Outcome set immediately on insert (no UPDATE needed)
  outcome       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'success', 'rate_limited', 'challenge_failed', 'cooldown', 'blocked')),
  -- SHA-1-like djb2 hash of user-agent + screen + language + timezone (client-computed, no PII)
  fingerprint   TEXT
);

-- Fast lookup: wallet + time range query for rate-limit checks
CREATE INDEX IF NOT EXISTS idx_purchase_attempts_wallet_time
  ON public.purchase_attempts (wallet, attempted_at DESC);

-- Fast lookup for admins reviewing by event
CREATE INDEX IF NOT EXISTS idx_purchase_attempts_event
  ON public.purchase_attempts (event_id, attempted_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.purchase_attempts ENABLE ROW LEVEL SECURITY;

-- Authenticated users may insert their own attempts
CREATE POLICY "attempt_insert_own"
  ON public.purchase_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users may read their own attempts (for self rate-limit checks)
CREATE POLICY "attempt_select_own"
  ON public.purchase_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins may read all attempts
CREATE POLICY "attempt_admin_select"
  ON public.purchase_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
