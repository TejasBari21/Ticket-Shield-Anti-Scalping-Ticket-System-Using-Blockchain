/**
 * Lightweight localStorage-based data store.
 * Replaces Supabase database queries.
 */

const EVENTS_KEY = "ticketshield_events";
const ARCHIVED_EVENTS_KEY = "ticketshield_archived_events";
const TICKETS_KEY = "ticketshield_tickets";
const AUDIT_KEY = "ticketshield_audit_log";

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

export interface ArchivedEventRecord {
  id: string;
  archived_at: string;
  archived_by?: string;
  reason: string;
  event: LocalEvent;
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
  events: { id: string; name: string; date: string; venue: string; location: string | null; image_url: string | null };
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

function readArchivedEvents(): ArchivedEventRecord[] {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVED_EVENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeArchivedEvents(records: ArchivedEventRecord[]) {
  localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(records));
  window.dispatchEvent(new StorageEvent("storage", { key: ARCHIVED_EVENTS_KEY }));
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

  getArchivedEvents(): ArchivedEventRecord[] {
    return readArchivedEvents().sort(
      (a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime(),
    );
  },

  archiveEndedEvent(id: string, archivedBy?: string): { ok: true; record: ArchivedEventRecord } | { ok: false; reason: string } {
    const events = readEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) {
      return { ok: false, reason: "Event not found." };
    }

    const event = events[idx];
    const endTimestamp = new Date(event.end_date || event.date).getTime();
    if (Number.isNaN(endTimestamp) || Date.now() < endTimestamp) {
      return { ok: false, reason: "Only ended events can be deleted." };
    }

    const record: ArchivedEventRecord = {
      id: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      archived_at: new Date().toISOString(),
      archived_by: archivedBy,
      reason: "admin_delete_after_end",
      event,
    };

    const archive = readArchivedEvents();
    archive.unshift(record);
    writeArchivedEvents(archive);

    events.splice(idx, 1);
    writeEvents(events);

    return { ok: true, record };
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

  seedDatabase(): void {
    const userId = "admin-001";
    const now = new Date();
    
    const events: LocalEvent[] = [
      {
        id: "evt-mumbai-2026",
        organizer_id: userId,
        name: "Mumbai Techno Night 2026",
        description: "An immersive audio-visual experience featuring top international techno artists. Join us for a night of rhythm and light at the heart of Mumbai.",
        date: new Date(now.getFullYear(), now.getMonth() + 2, 15, 20, 0).toISOString(),
        end_date: new Date(now.getFullYear(), now.getMonth() + 2, 16, 4, 0).toISOString(),
        venue: "Nesco Center",
        location: "Mumbai, India",
        image_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070",
        category: "music",
        status: "published",
        resale_enabled: true,
        resale_price_cap_percent: 120,
        created_at: now.toISOString(),
        ticket_tiers: [
          {
            id: "tier-m1",
            event_id: "evt-mumbai-2026",
            tier_name: "General Admission",
            price: 0.015,
            total_supply: 500,
            remaining_supply: 432,
            max_per_wallet: 4,
          },
          {
            id: "tier-m2",
            event_id: "evt-mumbai-2026",
            tier_name: "VIP Access",
            price: 0.04,
            total_supply: 100,
            remaining_supply: 12,
            max_per_wallet: 2,
          }
        ]
      },
      {
        id: "evt-tokyo-2026",
        organizer_id: userId,
        name: "Tokyo Blockchain Summit",
        description: "The premier gathering for blockchain innovators and enthusiasts in Asia. Explore the future of decentralized finance and Web3 technology.",
        date: new Date(now.getFullYear(), now.getMonth() + 3, 10, 9, 0).toISOString(),
        end_date: new Date(now.getFullYear(), now.getMonth() + 3, 12, 18, 0).toISOString(),
        venue: "Tokyo Big Sight",
        location: "Tokyo, Japan",
        image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070",
        category: "tech",
        status: "published",
        resale_enabled: true,
        resale_price_cap_percent: 100,
        created_at: now.toISOString(),
        ticket_tiers: [
          {
            id: "tier-t1",
            event_id: "evt-tokyo-2026",
            tier_name: "Standard Pass",
            price: 0.05,
            total_supply: 1000,
            remaining_supply: 850,
            max_per_wallet: 2,
          }
        ]
      },
      {
        id: "evt-london-2026",
        organizer_id: userId,
        name: "London Symphony Gala",
        description: "Experience the magic of classical music with the London Symphony Orchestra performing timeless masterpieces in a historic setting.",
        date: new Date(now.getFullYear(), now.getMonth() + 4, 22, 19, 30).toISOString(),
        end_date: null,
        venue: "Royal Albert Hall",
        location: "London, UK",
        image_url: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=2069",
        category: "music",
        status: "published",
        resale_enabled: false,
        resale_price_cap_percent: 100,
        created_at: now.toISOString(),
        ticket_tiers: [
          {
            id: "tier-l1",
            event_id: "evt-london-2026",
            tier_name: "Stalls",
            price: 0.03,
            total_supply: 200,
            remaining_supply: 45,
            max_per_wallet: 4,
          },
          {
            id: "tier-l2",
            event_id: "evt-london-2026",
            tier_name: "Gallery",
            price: 0.012,
            total_supply: 300,
            remaining_supply: 180,
            max_per_wallet: 6,
          }
        ]
      }
    ];
    
    writeEvents(events);
    // Log the seed action
    auditLogDB.log({ action: "event_created", user_id: userId, detail: "Seeded database with 3 sample events" });
  },
};

// Auto-seed if empty
if (typeof window !== "undefined") {
  const existing = localStorage.getItem(EVENTS_KEY);
  if (!existing || JSON.parse(existing).length === 0) {
    localDB.seedDatabase();
  }
}

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

/**
 * Enriches a ticket with event data, ensuring image_url is populated from the event
 */
function enrichTicketWithEventData(ticket: LocalTicket): LocalTicket {
  // If image_url already exists, return as is
  if (ticket.events?.image_url) {
    return ticket;
  }

  // Try to fetch the event and populate missing data
  try {
    const event = readEvents().find(e => e.id === ticket.event_id);
    if (event && !ticket.events?.image_url) {
      return {
        ...ticket,
        events: {
          ...ticket.events,
          image_url: event.image_url ?? null,
        },
      };
    }
  } catch {
    // If enrichment fails, return ticket as is
  }

  return ticket;
}

export const ticketDB = {
  getTickets(ownerUserId: string): LocalTicket[] {
    return readTickets()
      .filter((t) => t.owner_user_id === ownerUserId)
      .map(t => enrichTicketWithEventData(t))
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
    const ticket = readTickets().find((t) => t.id === ticketId) ?? null;
    return ticket ? enrichTicketWithEventData(ticket) : null;
  },

  getAllTickets(): LocalTicket[] {
    return readTickets()
      .map(t => enrichTicketWithEventData(t))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
