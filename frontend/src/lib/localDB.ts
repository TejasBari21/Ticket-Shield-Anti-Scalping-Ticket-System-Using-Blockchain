/**
 * Lightweight localStorage-based data store.
 * Replaces Supabase database queries.
 */

const EVENTS_KEY = "fairpass_events";
const TICKETS_KEY = "fairpass_tickets";
const AUDIT_KEY = "fairpass_audit_log";

/* ── Audit Log ─────────────────────────────────────────────────────── */

export type AuditAction =
  | "user_registration"
  | "wallet_connected"
  | "kyc_submitted"
  | "kyc_approved"
  | "kyc_rejected"
  | "event_created"
  | "ticket_purchased"
  | "ticket_resale"
  | "check_in";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  wallet?: string;
  user_id?: string;
  event_id?: string;
  event_name?: string;
  tx_hash?: string;
  detail?: string;
  timestamp: string;
}

function readAudit(): AuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAudit(entries: AuditEntry[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
  window.dispatchEvent(new StorageEvent("storage", { key: AUDIT_KEY }));
}

export const auditLogDB = {
  log(entry: Omit<AuditEntry, "id" | "timestamp">): void {
    const all = readAudit();
    all.unshift({
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    });
    // Keep at most 500 entries
    writeAudit(all.slice(0, 500));
  },

  getAll(): AuditEntry[] {
    return readAudit();
  },

  clear(): void {
    writeAudit([]);
  },
};

export interface LocalEvent {
  id: string;
  contract_event_id?: number; // on-chain event ID returned from EventTicket.createEvent()
  organizer_id: string;
  name: string;
  description: string | null;
  date: string;
  end_date: string | null;
  venue: string;
  location: string | null;
  image_url: string | null;
  category: string;
  status: string;
  resale_enabled: boolean;
  resale_price_cap_percent: number;
  kyc_required?: boolean;
  created_at: string;
  ticket_tiers: LocalTier[];
  // Geo-lock fields (optional — events without these skip geo check)
  venue_lat?: number;
  venue_lng?: number;
  geo_radius_m?: number; // metres; default 300 if lat/lng provided
}

export interface LocalTier {
  id: string;
  event_id: string;
  tier_name: string;
  price: number;
  total_supply: number;
  remaining_supply: number;
  max_per_wallet: number;
}

export interface LocalTicket {
  id: string;
  event_id: string;
  tier_id: string;
  owner_wallet: string;
  owner_user_id: string;
  status: "active" | "used" | "listed";
  purchase_tx: string;
  token_id: string;
  qr_secret: string;
  created_at: string;
  // Denormalized for display
  events: { id: string; name: string; date: string; venue: string; location: string | null };
  ticket_tiers: { tier_name: string; price: number };
}

function readEvents(): LocalEvent[] {
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeEvents(events: LocalEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  // Notify same-tab listeners (storage event only fires across tabs natively)
  window.dispatchEvent(new StorageEvent("storage", { key: EVENTS_KEY }));
}

export const localDB = {
  getEvents(filter?: { status?: string; organizer_id?: string }): LocalEvent[] {
    let events = readEvents().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    if (filter?.status) events = events.filter((e) => e.status === filter.status);
    if (filter?.organizer_id) events = events.filter((e) => e.organizer_id === filter.organizer_id);
    return events;
  },

  getEvent(id: string): LocalEvent | null {
    return readEvents().find((e) => e.id === id) ?? null;
  },

  createEvent(
    data: Omit<LocalEvent, "id" | "created_at" | "ticket_tiers">,
    tiers: Omit<LocalTier, "id" | "event_id">[],
  ): LocalEvent {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const mappedTiers: LocalTier[] = tiers.map((t) => ({
      ...t,
      id: `tier-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event_id: id,
    }));
    const event: LocalEvent = {
      ...data,
      id,
      created_at: new Date().toISOString(),
      ticket_tiers: mappedTiers,
    };
    const events = readEvents();
    events.push(event);
    writeEvents(events);
    return event;
  },

  updateEventStatus(id: string, status: string): void {
    const events = readEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      events[idx].status = status;
      writeEvents(events);
    }
  },

  updateEvent(
    id: string,
    data: Partial<Omit<LocalEvent, "id" | "created_at" | "ticket_tiers">>,
    tiers?: Omit<LocalTier, "id" | "event_id">[],
  ): LocalEvent | null {
    const events = readEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    events[idx] = { ...events[idx], ...data };
    if (tiers) {
      events[idx].ticket_tiers = tiers.map((t) => ({
        ...t,
        id: `tier-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        event_id: id,
      }));
    }
    writeEvents(events);
    return events[idx];
  },

  deleteEvent(id: string): void {
    writeEvents(readEvents().filter((e) => e.id !== id));
  },

  decrementTierSupply(eventId: string, tierId: string, qty: number): void {
    const events = readEvents();
    const evIdx = events.findIndex((e) => e.id === eventId);
    if (evIdx === -1) return;
    const tierIdx = events[evIdx].ticket_tiers.findIndex((t) => t.id === tierId);
    if (tierIdx === -1) return;
    const tier = events[evIdx].ticket_tiers[tierIdx];
    tier.remaining_supply = Math.max(0, tier.remaining_supply - qty);
    writeEvents(events);
  },
};

// ─── Ticket store ─────────────────────────────────────────────────────────────

function readTickets(): LocalTicket[] {
  try {
    return JSON.parse(localStorage.getItem(TICKETS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeTickets(tickets: LocalTicket[]) {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  window.dispatchEvent(new StorageEvent("storage", { key: TICKETS_KEY }));
}

export const ticketDB = {
  getTickets(ownerUserId: string): LocalTicket[] {
    return readTickets()
      .filter((t) => t.owner_user_id === ownerUserId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  saveTicket(ticket: LocalTicket): void {
    const all = readTickets();
    all.push(ticket);
    writeTickets(all);
  },

  saveTickets(tickets: LocalTicket[]): void {
    const all = readTickets();
    all.push(...tickets);
    writeTickets(all);
  },

  getTicketById(ticketId: string): LocalTicket | null {
    return readTickets().find((t) => t.id === ticketId) ?? null;
  },

  getAllTickets(): LocalTicket[] {
    return readTickets().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  markUsed(ticketId: string): void {
    const all = readTickets();
    const idx = all.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
      all[idx].status = "used";
      writeTickets(all);
    }
  },
};
