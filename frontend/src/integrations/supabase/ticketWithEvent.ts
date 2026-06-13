/**
 * Service for fetching complete ticket data with event information from Supabase
 * Used for generating PDFs and displaying ticket details
 */

import { supabase } from "@/integrations/supabase/client";
import type { TicketPDFData } from "@/lib/generateTicketPDF";

interface EventData {
  id: string;
  name: string;
  date: string;
  time?: string;
  venue: string;
  location?: string;
  image_url?: string | null;
}

interface TicketData {
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
  event_name: string;
  event_date: string;
  event_venue: string;
  event_location?: string;
  event_image_url?: string | null;
  tier_name: string;
  tier_price: number;
}

/**
 * Fetches complete ticket data from Supabase using ticket ID
 * This is the source of truth for all ticket information.
 * Includes retry logic and better error handling for network issues.
 */
export async function fetchTicketDataFromSupabase(ticketId: string): Promise<TicketData | null> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TicketData] Fetching ticket (attempt ${attempt + 1}/${maxRetries + 1}): ${ticketId}`);

      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,event_id,tier_id,owner_wallet,owner_user_id,status,purchase_tx,token_id,qr_secret,created_at,event_name,event_date,event_venue,event_location,event_image_url,tier_name,tier_price"
        )
        .eq("id", ticketId)
        .single();

      if (error) {
        lastError = new Error(`Supabase query error: ${error.message}`);
        console.warn(`[TicketData] Attempt ${attempt + 1} failed:`, error.message);
        
        // Retry on network errors
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
      }

      if (!data) {
        lastError = new Error(`Ticket not found: ${ticketId}`);
        console.warn(`[TicketData] Ticket not found after ${attempt + 1} attempt(s): ${ticketId}`);
        return null;
      }

      console.log(`[TicketData] Successfully fetched ticket: ${ticketId}`);
      return data as TicketData;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[TicketData] Exception on attempt ${attempt + 1}:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error(`[TicketData] Failed to fetch ticket after ${maxRetries + 1} attempts:`, lastError?.message);
  return null;
}

/**
 * Converts ticket data from Supabase into PDF-ready format
 * Uses ONLY live Supabase data, no hardcoded or cached values
 */
export function convertTicketToPDFData(ticket: TicketData): TicketPDFData {
  // Parse event date to handle different formats
  const eventDate = new Date(ticket.event_date);

  // Format date as DD MMM YYYY (e.g., "17 Mar 2026")
  const formattedDate = eventDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Format time as hh:mm A if available, otherwise use 00:00
  let formattedTime = "00:00 AM";
  try {
    // If event_date contains time info
    if (ticket.event_date && ticket.event_date.includes("T")) {
      const timeStr = eventDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      // Extract just HH:MM from the ISO string
      const parts = ticket.event_date.split("T");
      if (parts[1]) {
        const timeParts = parts[1].split(":");
        formattedTime = `${timeParts[0]}:${timeParts[1]} AM`;
      }
    }
  } catch (err) {
    console.warn("[TicketData] Error parsing time from event date:", err);
  }

  // Format booked timestamp: "Booked on: 17 Mar 2026, 10:45 AM"
  const bookedDate = new Date(ticket.created_at);
  const formattedBookedDate = bookedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedBookedTime = bookedDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const pdfData = {
    ticketId: ticket.id,
    qrSecret: ticket.qr_secret,
    eventName: ticket.event_name, // LIVE from Supabase
    eventDate: `${formattedDate}, ${formattedTime}`, // FORMATTED from Supabase
    venue: ticket.event_venue, // LIVE from Supabase
    tierName: ticket.tier_name, // LIVE from Supabase
    price: ticket.tier_price, // LIVE from Supabase
    purchaseTx: ticket.purchase_tx, // LIVE from Supabase
    tokenId: ticket.token_id, // LIVE from Supabase
    ownerWallet: ticket.owner_wallet, // LIVE from Supabase
    purchasedAt: `Booked on: ${formattedBookedDate}, ${formattedBookedTime}`, // LIVE from Supabase
    eventCode: ticket.event_id, // Use actual event ID
    imageUrl: ticket.event_image_url, // LIVE event image from Supabase
    eventLocation: ticket.event_location, // LIVE from Supabase
  } as TicketPDFData;

  console.log("[TicketData] Converted to PDF format:", {
    ticketId: pdfData.ticketId,
    eventName: pdfData.eventName,
    eventDate: pdfData.eventDate,
    venue: pdfData.venue,
    tierName: pdfData.tierName,
    imageUrl: pdfData.imageUrl,
    bookedTime: pdfData.purchasedAt,
  });

  return pdfData;
}

/**
 * Main function: Fetch ticket from Supabase and convert to PDF data
 * This ensures the PDF always uses live data, never cached/hardcoded values
 */
export async function getTicketPDFData(ticketId: string): Promise<TicketPDFData | null> {
  try {
    console.log(`[TicketData] Fetching complete ticket data for PDF: ${ticketId}`);

    // Fetch from Supabase (source of truth)
    const ticket = await fetchTicketDataFromSupabase(ticketId);

    if (!ticket) {
      console.error(`[TicketData] Failed to load ticket data for: ${ticketId}`);
      return null;
    }

    // Convert to PDF format
    const pdfData = convertTicketToPDFData(ticket);

    console.log(`[TicketData] PDF data prepared successfully for ticket: ${ticketId}`);
    return pdfData;
  } catch (err) {
    console.error(`[TicketData] Exception in getTicketPDFData:`, err);
    return null;
  }
}
