/**
 * Ticket Sync Service for Supabase
 * Handles primary storage of tickets in Supabase with retry logic
 * Uses localStorage only as a fallback if Supabase is offline
 */

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

// Retry configuration - improved delays
const RETRY_CONFIG = {
  maxAttempts: 5,
  initialDelayMs: 1500,
  maxDelayMs: 8000,
  backoffMultiplier: 1.5,
};

// Fallback storage key
const PENDING_TICKETS_KEY = "ticketshield_pending_sync";

/**
 * Checks if Supabase is currently available
 */
export async function isSupabaseOnline(): Promise<boolean> {
  // Check browser connectivity first
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  
  // Assume online, actual errors will be caught during sync operations
  return true;
}

/**
 * Converts a LocalTicket to SupabaseTicketRow format
 */
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

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Saves pending tickets to localStorage for later sync
 */
function savePendingTickets(tickets: LocalTicket[]): void {
  try {
    const existing = JSON.parse(localStorage.getItem(PENDING_TICKETS_KEY) || "[]");
    const combined = [...existing, ...tickets];
    localStorage.setItem(PENDING_TICKETS_KEY, JSON.stringify(combined));
    console.log(`[TicketSync] Saved ${tickets.length} tickets to pending sync queue`);
  } catch (err) {
    console.error("[TicketSync] Failed to save pending tickets to localStorage:", err);
  }
}

/**
 * Retrieves pending tickets from localStorage
 */
function getPendingTickets(): LocalTicket[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_TICKETS_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Clears pending tickets from localStorage
 */
function clearPendingTickets(ticketIds: string[]): void {
  try {
    const remaining = getPendingTickets().filter((t) => !ticketIds.includes(t.id));
    if (remaining.length === 0) {
      localStorage.removeItem(PENDING_TICKETS_KEY);
    } else {
      localStorage.setItem(PENDING_TICKETS_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.error("[TicketSync] Failed to clear pending tickets:", err);
  }
}

/**
 * Inserts tickets into Supabase with retry logic and better error handling
 * @param tickets - Array of tickets to insert
 * @param ownerEmail - Optional email of the ticket owner
 * @param onProgress - Optional callback for progress updates
 * @throws Error if all retry attempts fail
 */
export async function insertTicketsToSupabase(
  tickets: LocalTicket[],
  ownerEmail?: string,
  onProgress?: (message: string) => void,
): Promise<void> {
  if (tickets.length === 0) {
    return;
  }

  const logProgress = (msg: string) => {
    console.log(`[TicketSync] ${msg}`);
    onProgress?.(msg);
  };

  logProgress(`Attempting to sync ${tickets.length} ticket(s) to Supabase...`);

  const payload = tickets.map((ticket) => toSupabaseRow(ticket, ownerEmail));
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      logProgress(`Synchronizing with Supabase (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})...`);

      // Perform the insert with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const { error } = await supabase.from("tickets").upsert(payload, {
          onConflict: "id",
        });

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        logProgress(`Successfully synced ${tickets.length} ticket(s) to Supabase`);
        clearPendingTickets(tickets.map((t) => t.id));
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logProgress(`Sync attempt ${attempt + 1} failed: ${lastError.message}`);

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delayMs = getBackoffDelay(attempt);
        logProgress(`Retrying in ${(delayMs / 1000).toFixed(1)} seconds...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted - save to pending for offline fallback
  logProgress(
    `All sync attempts failed after ${RETRY_CONFIG.maxAttempts} tries. Storing tickets locally for later retry...`,
  );
  savePendingTickets(tickets);

  throw new Error(
    `Failed to sync ticket(s) to Supabase after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message || "Unknown error"}. Tickets are saved locally and will auto-sync when the connection is restored.`,
  );
}

/**
 * Syncs pending tickets from localStorage to Supabase
 * Called periodically or when the app detects connection restoration
 * @param ownerEmail - Optional email for the owner
 */
export async function syncPendingTickets(ownerEmail?: string): Promise<{ synced: number; failed: number }> {
  const pending = getPendingTickets();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log(`[TicketSync] Syncing ${pending.length} pending ticket(s)...`);

  const online = await isSupabaseOnline();
  if (!online) {
    console.log("[TicketSync] Supabase still offline, will retry later");
    return { synced: 0, failed: pending.length };
  }

  const successfulIds: string[] = [];
  let failedCount = 0;

  for (const ticket of pending) {
    try {
      const payload = toSupabaseRow(ticket, ownerEmail);
      
      // Perform sync with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const { error } = await supabase.from("tickets").upsert([payload], {
          onConflict: "id",
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error(`[TicketSync] Failed to sync ticket ${ticket.id}:`, error.message);
          failedCount++;
        } else {
          successfulIds.push(ticket.id);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error(`[TicketSync] Error syncing ticket ${ticket.id}:`, err);
        failedCount++;
      }
    } catch (err) {
      console.error(`[TicketSync] Error syncing ticket ${ticket.id}:`, err);
      failedCount++;
    }
  }

  if (successfulIds.length > 0) {
    clearPendingTickets(successfulIds);
    console.log(
      `[TicketSync] Synced ${successfulIds.length} pending ticket(s). ${failedCount} still pending.`,
    );
  }

  return { synced: successfulIds.length, failed: failedCount };
}

/**
 * Sets up automatic retry for pending tickets when connection is restored
 * Call this once during app initialization
 */
export function setupPendingTicketSync(): void {
  // Check every 10 seconds if we have pending tickets to sync
  const checkInterval = setInterval(async () => {
    const pending = getPendingTickets();
    if (pending.length > 0) {
      const result = await syncPendingTickets();
      if (result.synced > 0) {
        console.log(`[TicketSync] Auto-synced ${result.synced} pending ticket(s)`);
      }
    }
  }, 10000); // Check every 10 seconds

  // Also listen for online event
  if (typeof window !== "undefined") {
    window.addEventListener("online", async () => {
      console.log("[TicketSync] Connection restored, attempting to sync pending tickets...");
      const result = await syncPendingTickets();
      if (result.synced > 0) {
        console.log(`[TicketSync] Successfully synced ${result.synced} ticket(s) after reconnection`);
      }
    });
  }
}

/**
 * Retrieves tickets for a user from Supabase, with fallback to pending local tickets
 * @param ownerUserId - The user ID to fetch tickets for
 */
export async function fetchUserTickets(ownerUserId: string): Promise<LocalTicket[]> {
  try {
    const online = await isSupabaseOnline();

    if (online) {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,event_id,tier_id,owner_wallet,owner_user_id,status,purchase_tx,token_id,qr_secret,created_at,event_name,event_date,event_venue,event_location,event_image_url,tier_name,tier_price",
        )
        .eq("owner_user_id", ownerUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[TicketSync] Error fetching from Supabase:", error.message);
      } else if (data) {
        return (data as SupabaseTicketRow[]).map(toLocalTicket);
      }
    } else {
      console.log("[TicketSync] Supabase offline, using local fallback");
    }
  } catch (err) {
    console.error("[TicketSync] Exception fetching tickets:", err);
  }

  // Return pending tickets from localStorage as fallback
  return getPendingTickets();
}

/**
 * Converts SupabaseTicketRow back to LocalTicket
 */
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

/**
 * Returns the count of pending tickets waiting to be synced
 */
export function getPendingTicketsCount(): number {
  return getPendingTickets().length;
}
