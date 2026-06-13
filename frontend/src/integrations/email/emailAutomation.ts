/**
 * Email Automation Service
 * Sends tickets and confirmation emails automatically after booking
 * Handles retries, error logging, and email status tracking
 */

import { sendTicketConfirmationEmail } from "@/integrations/email/emailService";

interface EmailAutomationConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: EmailAutomationConfig = {
  maxRetries: 3,
  retryDelayMs: 2000,
  backoffMultiplier: 1.5,
  timeoutMs: 30000,
};

interface BookingEmailData {
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
  ticketUrl: string;
  pdfData?: ArrayBuffer;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  attempt?: number;
  totalAttempts?: number;
}

/**
 * Wait for a specified duration
 */
async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send email with exponential backoff retry logic
 */
async function sendEmailWithRetry(
  data: BookingEmailData,
  config: EmailAutomationConfig = DEFAULT_CONFIG,
  attempt = 1
): Promise<EmailSendResult> {
  try {
    console.log(`[Email Automation] Attempt ${attempt}/${config.maxRetries} - Sending confirmation email to ${data.email}`);

    const result = await Promise.race([
      sendTicketConfirmationEmail({
        email: data.email,
        userId: data.userId,
        userFirstName: data.userFirstName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        venue: data.venue,
        location: data.location,
        tierName: data.tierName,
        quantity: data.quantity,
        price: data.price,
        totalPrice: data.totalPrice,
        ticketId: data.ticketId,
        purchaseDate: data.purchaseDate,
        ticketUrl: data.ticketUrl,
        ticketPdfBuffer: data.pdfData,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Email sending timeout")), config.timeoutMs)
      ),
    ]);

    console.log(`✅ [Email Automation] Email sent successfully to ${data.email}`, {
      messageId: result.messageId,
      provider: result.provider,
      attempt,
    });

    return {
      success: true,
      messageId: result.messageId,
      provider: result.provider,
      attempt,
      totalAttempts: config.maxRetries,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.warn(`⚠️ [Email Automation] Attempt ${attempt} failed: ${errorMessage}`);

    // If we haven't exceeded max retries, try again with exponential backoff
    if (attempt < config.maxRetries) {
      const delayMs = config.retryDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      console.log(`[Email Automation] Retrying in ${delayMs}ms...`);
      await wait(delayMs);
      return sendEmailWithRetry(data, config, attempt + 1);
    }

    // Max retries exceeded
    console.error(`❌ [Email Automation] Failed after ${config.maxRetries} attempts: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      attempt,
      totalAttempts: config.maxRetries,
    };
  }
}

/**
 * Send booking confirmation email with automatic retry logic
 * Called after successful ticket booking and blockchain transaction
 */
export async function sendBookingConfirmationEmail(
  data: BookingEmailData,
  config?: Partial<EmailAutomationConfig>
): Promise<EmailSendResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Validate required fields
    if (!data.email || !data.ticketId || !data.eventName) {
      throw new Error("Missing required fields: email, ticketId, eventName");
    }

    console.log(`[Email Automation] Starting email automation for ticket ${data.ticketId}`);

    const result = await sendEmailWithRetry(data, finalConfig);

    if (result.success) {
      // Log success to localStorage for records
      logEmailSent({
        ticketId: data.ticketId,
        email: data.email,
        eventName: data.eventName,
        timestamp: new Date().toISOString(),
        messageId: result.messageId,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email Automation] Error in booking confirmation:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Log email sending for tracking and debugging
 */
function logEmailSent(data: {
  ticketId: string;
  email: string;
  eventName: string;
  timestamp: string;
  messageId?: string;
}): void {
  try {
    // Store in localStorage for tracking
    const key = "ticketshield_emails_sent";
    const existing = localStorage.getItem(key);
    const logs = existing ? JSON.parse(existing) : [];

    logs.push({
      ...data,
      id: `${data.ticketId}_${Date.now()}`,
    });

    // Keep only last 100 logs
    const recentLogs = logs.slice(-100);
    localStorage.setItem(key, JSON.stringify(recentLogs));

    console.log(`[Email Automation] Email log saved (total: ${recentLogs.length})`);
  } catch (err) {
    console.warn(`[Email Automation] Failed to save email log:`, err);
  }
}

/**
 * Get email sending history for debugging
 */
export function getEmailSendingHistory(limit = 20): Array<{
  ticketId: string;
  email: string;
  eventName: string;
  timestamp: string;
  messageId?: string;
}> {
  try {
    const key = "ticketshield_emails_sent";
    const existing = localStorage.getItem(key);
    const logs = existing ? JSON.parse(existing) : [];
    return logs.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Clear email sending history
 */
export function clearEmailSendingHistory(): void {
  try {
    localStorage.removeItem("ticketshield_emails_sent");
    console.log("[Email Automation] Email history cleared");
  } catch (err) {
    console.warn("[Email Automation] Failed to clear history:", err);
  }
}

/**
 * Check if email was recently sent for a ticket
 */
export function wasEmailRecentlySent(ticketId: string, withinMinutes = 5): boolean {
  const history = getEmailSendingHistory(100);
  const recentTime = Date.now() - withinMinutes * 60 * 1000;

  const recentEmail = history.find(
    (entry) => entry.ticketId === ticketId && new Date(entry.timestamp).getTime() > recentTime
  );

  return !!recentEmail;
}

/**
 * Resend email for a ticket (with duplicate prevention)
 */
export async function resendBookingEmail(
  ticketId: string,
  data: BookingEmailData,
  forceResend = false
): Promise<EmailSendResult> {
  if (wasEmailRecentlySent(ticketId, 5) && !forceResend) {
    return {
      success: false,
      error: "Email was sent recently. Please wait before resending.",
    };
  }

  console.log(`[Email Automation] Resending email for ticket ${ticketId}`);
  return sendBookingConfirmationEmail(data);
}

/**
 * Batch send emails for multiple tickets
 */
export async function sendBatchBookingEmails(
  emailDataList: BookingEmailData[],
  concurrent = 2
): Promise<Array<{ ticketId: string; result: EmailSendResult }>> {
  console.log(`[Email Automation] Starting batch email send for ${emailDataList.length} tickets`);

  const results: Array<{ ticketId: string; result: EmailSendResult }> = [];
  const queue = [...emailDataList];

  const sendQueue = async () => {
    while (queue.length > 0) {
      const emailData = queue.shift();
      if (!emailData) break;

      try {
        const result = await sendBookingConfirmationEmail(emailData);
        results.push({
          ticketId: emailData.ticketId,
          result,
        });
      } catch (error) {
        console.error(`[Email Automation] Error sending email for ${emailData.ticketId}:`, error);
        results.push({
          ticketId: emailData.ticketId,
          result: {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
  };

  // Run concurrent workers
  const workers = Array(concurrent).fill(null).map(() => sendQueue());
  await Promise.all(workers);

  console.log(`[Email Automation] Batch send complete: ${results.filter((r) => r.result.success).length}/${results.length} successful`);

  return results;
}
