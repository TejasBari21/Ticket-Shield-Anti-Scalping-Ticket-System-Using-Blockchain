/**
 * Email Integration Service for Frontend
 * Handles sending ticket confirmation emails after successful bookings
 * Called from EventDetail.tsx after ticket purchase completes
 */

import { supabase } from "@/integrations/supabase/client";

interface TicketConfirmationData {
  email: string;
  userId: string;
  userFirstName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  venue: string;
  location?: string;
  tierName: string;
  quantity: number;
  price: number;
  totalPrice: number;
  ticketId: string;
  purchaseDate: string;
  ticketPdfBuffer?: ArrayBuffer; // Optional: PDF as binary
  ticketUrl: string;
}

/**
 * Send ticket confirmation email via backend API
 * This is called after successful blockchain transaction and Supabase sync
 * @param data - Ticket confirmation data
 * @returns Promise<{success: boolean, messageId?: string, error?: string}>
 */
export async function sendTicketConfirmationEmail(
  data: TicketConfirmationData
): Promise<{
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  try {
    console.log(`[Email Integration] Sending confirmation email for ticket ${data.ticketId}`);

    // Prepare the request body
    const requestBody = {
      email: data.email,
      userId: data.userId,
      userFirstName: data.userFirstName,
      eventName: data.eventName,
      eventDate: data.eventDate,
      eventTime: data.eventTime || "",
      venue: data.venue,
      location: data.location || "",
      tierName: data.tierName,
      quantity: data.quantity,
      price: data.price,
      totalPrice: data.totalPrice,
      ticketId: data.ticketId,
      purchaseDate: data.purchaseDate,
      ticketUrl: data.ticketUrl,
    };

    // If PDF buffer is provided, convert to base64 for transmission
    if (data.ticketPdfBuffer) {
      const uint8Array = new Uint8Array(data.ticketPdfBuffer);
      const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
      const base64 = btoa(binaryString);
      (requestBody as any).ticketPdfBase64 = base64;
    }

    // Call backend email API
    const response = await fetch(`${API_BASE_URL}/api/email/send-ticket-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      
      console.error(`[Email Integration] Failed to send email: ${errorMsg}`);
      
      // Don't fail the entire purchase if email fails
      // Email is secondary to actual ticket purchase
      return {
        success: false,
        error: errorMsg,
      };
    }

    const result = await response.json();
    
    console.log(`✅ [Email Integration] Confirmation email sent successfully`, {
      messageId: result.messageId,
      provider: result.provider,
      ticketId: data.ticketId,
    });

    return {
      success: true,
      messageId: result.messageId,
      provider: result.provider,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Email Integration] Error sending confirmation email: ${errorMsg}`);

    // Return failure but don't throw - email is not critical to purchase
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Check if email service is configured
 * Useful for determining if email functionality is available
 */
export async function checkEmailServiceStatus(): Promise<{
  configured: boolean;
  provider?: string;
}> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${API_BASE_URL}/api/email/status`);
    
    if (!response.ok) {
      return { configured: false };
    }

    const result = await response.json();
    return {
      configured: result.configured,
      provider: result.provider,
    };
  } catch (error) {
    console.warn(`[Email Integration] Could not check email service status:`, error);
    return { configured: false };
  }
}

/**
 * Update user's email notification preferences
 * @param userId - User's MongoDB ID
 * @param enabled - Whether to receive email notifications
 */
export async function updateEmailPreferences(
  userId: string,
  enabled: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${API_BASE_URL}/api/email/preferences/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_notifications_enabled: enabled }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    console.log(`[Email Integration] Email preferences updated for user ${userId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Generate proper ticket URL for email CTA button
 * @param ticketId - Ticket ID
 */
export function getTicketViewUrl(ticketId: string): string {
  const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5173";
  return `${appBaseUrl}/tickets/${ticketId}`;
}
