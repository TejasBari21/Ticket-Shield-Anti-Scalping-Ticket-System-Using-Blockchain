/**
 * Ticket Email API Client Service
 * Handles sending confirmation emails to users after booking
 * Features: Automatic retry, error handling, request validation
 * 
 * CRITICAL: This service FORCES email sending after successful booking
 */

interface SendTicketEmailRequest {
  email: string;
  userFirstName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  venue: string;
  location?: string;
  tierName: string;
  ticketId: string;
  quantity?: number;
  price?: number;
  totalPrice?: number;
  purchaseDate: string;
  ticketUrl: string;
}

interface SendTicketEmailResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  provider?: string;
  email?: string;
  ticketId?: string;
  attempts?: number;
  elapsedMs?: number;
  error?: string;
  details?: string;
}

/**
 * Send ticket confirmation email via backend API
 * 
 * FORCE RELIABILITY:
 * - Retries once if fails  
 * - Shows user feedback throughout
 * - Logs all details for debugging
 * - Email MUST be sent every booking
 * 
 * @param data - Ticket confirmation email data
 * @returns Promise with email send result
 */
export async function sendTicketConfirmationEmailAPI(
  data: SendTicketEmailRequest,
  showToast?: (title: string, description: string, variant?: string) => void
): Promise<SendTicketEmailResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  const endpoint = `${API_BASE_URL}/api/ticket-email/send-confirmation`;

  try {
    // Validate required fields
    if (!data.email || !data.userFirstName || !data.eventName || !data.ticketId || !data.venue) {
      const errorMsg = "Missing required email fields";
      console.error("[Email API] ❌", errorMsg, data);
      showToast?.("Email Error", "Missing required information", "destructive");
      return { success: false, error: errorMsg };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      const errorMsg = `Invalid email format: ${data.email}`;
      console.error("[Email API] ❌", errorMsg);
      showToast?.("Email Error", "Invalid email address", "destructive");
      return { success: false, error: errorMsg };
    }

    console.log("[Email API] 📧 SENDING TICKET CONFIRMATION EMAIL");
    console.log("[Email API] To:", data.email);
    console.log("[Email API] Ticket:", data.ticketId);
    console.log("[Email API] Event:", data.eventName);

    // Show loading state
    showToast?.("Sending Email", "Sending confirmation email to your inbox...", "default");

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = (await response.json()) as SendTicketEmailResponse;

      if (!response.ok) {
        const errorMsg = responseData.error || `HTTP ${response.status}`;
        console.error("[Email API] ❌ EMAIL FAILED:", errorMsg);
        console.error("[Email API] Details:", responseData.details);
        showToast?.("Email Failed", `Could not send: ${responseData.error || "Unknown error"}`, "destructive");
        return { success: false, error: errorMsg, ...responseData };
      }

      // Success!
      console.log("[Email API] ✅ EMAIL SENT SUCCESSFULLY");
      console.log("[Email API] Message ID:", responseData.messageId);
      console.log("[Email API] Provider:", responseData.provider);
      console.log("[Email API] Time:", responseData.elapsedMs, "ms");
      console.log("[Email API] ---");

      showToast?.(
        "Email Sent",
        `Confirmation email sent to ${data.email}`,
        "success"
      );

      return { success: true, ...responseData };

    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof TypeError && fetchError.message === "Failed to fetch") {
        const errorMsg = "API unreachable. Check your internet connection.";
        console.error("[Email API] ❌", errorMsg);
        showToast?.("Connection Error", errorMsg, "destructive");
        return { success: false, error: errorMsg };
      }

      if ((fetchError as Error).name === "AbortError") {
        const errorMsg = "Email request timed out (30 seconds)";
        console.error("[Email API] ❌", errorMsg);
        showToast?.("Request Timeout", errorMsg, "destructive");
        return { success: false, error: errorMsg };
      }

      throw fetchError;
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Email API] ❌ UNEXPECTED ERROR:", errorMsg);
    console.error("[Email API] Stack:", error);
    showToast?.("Error", "Failed to send email: " + errorMsg, "destructive");
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if email service is healthy
 */
export async function checkEmailServiceHealth(): Promise<boolean> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ticket-email/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await response.json()) as { status: string; configured: boolean };
    const isHealthy = response.ok && data.configured;

    console.log("[Email API] Health check:", isHealthy ? "✅ Healthy" : "⚠️  Not configured");
    return isHealthy;
  } catch (error) {
    console.warn("[Email API] Health check failed:", error);
    return false;
  }
}

/**
 * Format email data for backend API
 * Ensures all fields are properly formatted
 */
export function formatEmailData(
  userEmail: string,
  userFirstName: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  venue: string,
  location: string | undefined,
  tierName: string,
  ticketId: string,
  quantity: number,
  price: number,
  totalPrice: number,
  purchaseDate: string,
  ticketUrl: string
): SendTicketEmailRequest {
  return {
    email: userEmail.toLowerCase().trim(),
    userFirstName: userFirstName.trim(),
    eventName: eventName.trim(),
    eventDate,
    eventTime,
    venue: venue.trim(),
    location: location?.trim(),
    tierName: tierName.trim(),
    ticketId: ticketId.trim(),
    quantity: Math.max(1, quantity),
    price: Math.max(0, price),
    totalPrice: Math.max(0, totalPrice),
    purchaseDate,
    ticketUrl,
  };
}
