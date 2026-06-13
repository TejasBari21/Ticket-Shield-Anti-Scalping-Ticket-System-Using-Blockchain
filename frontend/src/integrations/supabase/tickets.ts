import { supabase } from "@/integrations/supabase/client";
import type { LocalTicket } from "@/lib/localDB";

interface SupabaseTicketRow {
  id: string;
  event_id: string;
  tier_id: string;
  owner_email: string | null;
  owner_wallet: string;
  owner_user_id: string;
  status: "active" | "used" | "listed";
  purchase_tx: string;
  token_id: string;
  qr_secret: string;
  created_at: string;
  event_name: string;
  event_date: string;
  event_venue: string;
  event_location: string | null;
  event_image_url: string | null;
  tier_name: string;
  tier_price: number;
}

function toSupabaseRow(ticket: LocalTicket, ownerEmail?: string): SupabaseTicketRow {
  return {
    id: ticket.id,
    event_id: ticket.event_id,
    tier_id: ticket.tier_id,
    owner_email: ownerEmail ?? null,
    owner_wallet: ticket.owner_wallet,
    owner_user_id: ticket.owner_user_id,
    status: ticket.status,
    purchase_tx: ticket.purchase_tx,
    token_id: ticket.token_id,
    qr_secret: ticket.qr_secret,
    created_at: ticket.created_at,
    event_name: ticket.events.name,
    event_date: ticket.events.date,
    event_venue: ticket.events.venue,
    event_location: ticket.events.location,
    event_image_url: ticket.events.image_url,
    tier_name: ticket.ticket_tiers.tier_name,
    tier_price: ticket.ticket_tiers.price,
  };
}

function toLocalTicket(row: SupabaseTicketRow): LocalTicket {
  return {
    id: row.id,
    event_id: row.event_id,
    tier_id: row.tier_id,
    owner_wallet: row.owner_wallet,
    owner_user_id: row.owner_user_id,
    status: row.status,
    purchase_tx: row.purchase_tx,
    token_id: row.token_id,
    qr_secret: row.qr_secret,
    created_at: row.created_at,
    events: {
      id: row.event_id,
      name: row.event_name,
      date: row.event_date,
      venue: row.event_venue,
      location: row.event_location,
      image_url: row.event_image_url,
    },
    ticket_tiers: {
      tier_name: row.tier_name,
      price: row.tier_price,
    },
  };
}

export async function savePurchasedTicketsToSupabase(
  tickets: LocalTicket[],
  ownerEmail?: string,
): Promise<void> {
  if (tickets.length === 0) return;

  const payload = tickets.map((ticket) => toSupabaseRow(ticket, ownerEmail));

  const { error } = await supabase
    .from("tickets")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchUserTicketsFromSupabase(ownerUserId: string): Promise<LocalTicket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,event_id,tier_id,owner_wallet,owner_user_id,status,purchase_tx,token_id,qr_secret,created_at,event_name,event_date,event_venue,event_location,event_image_url,tier_name,tier_price",
    )
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as SupabaseTicketRow[] | null) ?? []).map(toLocalTicket);
}
