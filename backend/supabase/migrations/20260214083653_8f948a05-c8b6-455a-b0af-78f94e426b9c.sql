
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('buyer', 'organizer', 'admin');

-- Create event status enum
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- Create ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('active', 'used', 'listed', 'expired', 'transferred');

-- Create listing status enum
CREATE TYPE public.listing_status AS ENUM ('active', 'sold', 'cancelled');

-- Create transaction type enum
CREATE TYPE public.tx_type AS ENUM ('purchase', 'resale');

-- ============ TABLES ============

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  venue TEXT NOT NULL,
  location TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'general',
  status event_status NOT NULL DEFAULT 'draft',
  resale_enabled BOOLEAN NOT NULL DEFAULT true,
  resale_price_cap_percent INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket tiers
CREATE TABLE public.ticket_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  total_supply INTEGER NOT NULL DEFAULT 100,
  remaining_supply INTEGER NOT NULL DEFAULT 100,
  max_per_wallet INTEGER NOT NULL DEFAULT 4,
  sales_start TIMESTAMPTZ,
  sales_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_wallet TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  status ticket_status NOT NULL DEFAULT 'active',
  purchase_tx TEXT,
  token_id TEXT,
  qr_secret TEXT DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resale listings
CREATE TABLE public.resale_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  seller_wallet TEXT NOT NULL,
  seller_user_id UUID REFERENCES auth.users(id),
  asking_price NUMERIC NOT NULL,
  price_cap NUMERIC,
  status listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id),
  from_wallet TEXT,
  to_wallet TEXT NOT NULL,
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  price NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  tx_type tx_type NOT NULL DEFAULT 'purchase',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Check-ins
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checked_in_by UUID REFERENCES auth.users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ INDEXES ============
CREATE INDEX idx_profiles_wallet ON public.profiles(wallet_address);
CREATE INDEX idx_events_organizer ON public.events(organizer_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_ticket_tiers_event ON public.ticket_tiers(event_id);
CREATE INDEX idx_tickets_owner ON public.tickets(owner_wallet);
CREATE INDEX idx_tickets_event ON public.tickets(event_id);
CREATE INDEX idx_tickets_owner_user ON public.tickets(owner_user_id);
CREATE INDEX idx_resale_status ON public.resale_listings(status);
CREATE INDEX idx_transactions_to ON public.transactions(to_wallet);
CREATE INDEX idx_transactions_from ON public.transactions(from_wallet);

-- ============ HELPER FUNCTIONS ============

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Check if current user is organizer of event
CREATE OR REPLACE FUNCTION public.is_organizer_of_event(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id AND organizer_id = auth.uid()
  )
$$;

-- Get current user's wallet address
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wallet_address FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ TRIGGERS ============
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resale_updated_at BEFORE UPDATE ON public.resale_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- User roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published events are viewable by everyone" ON public.events FOR SELECT USING (status = 'published' OR organizer_id = auth.uid() OR public.is_admin());
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (organizer_id = auth.uid());
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated USING (organizer_id = auth.uid());
CREATE POLICY "Organizers can delete own events" ON public.events FOR DELETE TO authenticated USING (organizer_id = auth.uid());

-- Ticket tiers
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket tiers viewable with event" ON public.ticket_tiers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = ticket_tiers.event_id AND (events.status = 'published' OR events.organizer_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Organizers can manage tiers" ON public.ticket_tiers FOR INSERT TO authenticated WITH CHECK (public.is_organizer_of_event(event_id));
CREATE POLICY "Organizers can update tiers" ON public.ticket_tiers FOR UPDATE TO authenticated USING (public.is_organizer_of_event(event_id));
CREATE POLICY "Organizers can delete tiers" ON public.ticket_tiers FOR DELETE TO authenticated USING (public.is_organizer_of_event(event_id));

-- Tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tickets or organizer sees event tickets" ON public.tickets FOR SELECT TO authenticated USING (
  owner_user_id = auth.uid() OR public.is_organizer_of_event(event_id) OR public.is_admin()
);
CREATE POLICY "System can create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Owners can update own tickets" ON public.tickets FOR UPDATE TO authenticated USING (owner_user_id = auth.uid());

-- Resale listings
ALTER TABLE public.resale_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings are public" ON public.resale_listings FOR SELECT USING (status = 'active' OR seller_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Ticket owners can create listings" ON public.resale_listings FOR INSERT TO authenticated WITH CHECK (seller_user_id = auth.uid());
CREATE POLICY "Sellers can update own listings" ON public.resale_listings FOR UPDATE TO authenticated USING (seller_user_id = auth.uid());
CREATE POLICY "Sellers can delete own listings" ON public.resale_listings FOR DELETE TO authenticated USING (seller_user_id = auth.uid());

-- Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON public.transactions FOR SELECT TO authenticated USING (
  to_user_id = auth.uid() OR from_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "Authenticated can create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (to_user_id = auth.uid());

-- Check-ins
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers and admins can view check-ins" ON public.check_ins FOR SELECT TO authenticated USING (
  public.is_organizer_of_event(event_id) OR public.is_admin()
);
CREATE POLICY "Organizers can create check-ins" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (
  public.is_organizer_of_event(event_id) OR public.is_admin()
);
