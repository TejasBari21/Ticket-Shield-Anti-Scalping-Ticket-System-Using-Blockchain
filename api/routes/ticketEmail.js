import express from 'express';
import { Resend } from 'resend';

const router = express.Router();
let resend = null;

// Initialize Resend on first use
function getResendClient() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    console.log(`[Email] Resend API Key status: ${apiKey ? '✅ PRESENT' : '❌ MISSING'}`);
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not set in environment variables');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * POST /api/send-ticket-email
 * Send ticket confirmation email immediately after booking
 * USES RESEND ONLY - No fallbacks
 */
router.post('/send-ticket-email', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, userFirstName, eventName, eventDate, eventTime, venue, ticketId } = req.body;

    console.log(`\n========================================`);
    console.log(`[EMAIL] BOOKING CONFIRMATION TRIGGERED`);
    console.log(`[EMAIL] To: ${email}`);
    console.log(`[EMAIL] Event: ${eventName}`);
    console.log(`[EMAIL] Ticket: ${ticketId}`);
    console.log(`========================================\n`);

    // Validate required fields
    if (!email || !userFirstName || !eventName || !ticketId) {
      console.error('[EMAIL] ❌ Missing required fields:', { email, userFirstName, eventName, ticketId });
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('[EMAIL] ❌ Invalid email format:', email);
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const client = getResendClient();

    // Generate professional HTML email
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f7f8; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;">
          <div style="background: linear-gradient(135deg, #1BA6A6 0%, #0E8585 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px;">🎟️ Ticket Confirmed!</h1>
          </div>
          
          <p style="font-size: 16px; color: #1F2933; margin-bottom: 20px;">
            Hi <strong>${userFirstName}</strong>,
          </p>
          
          <p style="font-size: 14px; color: #6B7280; margin-bottom: 20px;">
            Your ticket for <strong>${eventName}</strong> has been successfully booked.
          </p>
          
          <div style="background: #CFEFEF; border-left: 4px solid #1BA6A6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0; color: #1F2933;"><strong>Event:</strong> ${eventName}</p>
            <p style="margin: 5px 0; color: #1F2933;"><strong>Date & Time:</strong> ${eventDate}${eventTime ? ', ' + eventTime : ''}</p>
            <p style="margin: 5px 0; color: #1F2933;"><strong>Venue:</strong> ${venue}</p>
            <p style="margin: 5px 0; color: #1BA6A6; font-weight: bold;"><strong>Ticket ID:</strong> ${ticketId}</p>
          </div>
          
          <p style="font-size: 12px; color: #6B7280; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E8EAED;">
            Thank you for booking with TicketShield!
          </p>
        </div>
      </body>
    </html>
    `;

    console.log('[EMAIL] Sending via Resend...');
    
    const response = await client.emails.send({
      from: 'TicketShield <noreply@ticketshield.app>',
      to: email,
      subject: `🎟️ Your Ticket is Confirmed – ${eventName}`,
      html: htmlContent,
    });

    console.log('[EMAIL] Resend response:', response);

    if (response.error) {
      const errorMsg = response.error?.message || 'Unknown Resend error';
      console.error(`[EMAIL] ❌ RESEND API ERROR: ${errorMsg}`);
      return res.status(500).json({
        success: false,
        error: `Email send failed: ${errorMsg}`,
        provider: 'Resend',
      });
    }

    if (!response.id) {
      console.error('[EMAIL] ❌ No message ID returned from Resend');
      return res.status(500).json({
        success: false,
        error: 'No message ID returned from Resend',
        provider: 'Resend',
      });
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`\n✅ [EMAIL] SUCCESS!`);
    console.log(`[EMAIL] Message ID: ${response.id}`);
    console.log(`[EMAIL] Sent to: ${email}`);
    console.log(`[EMAIL] Time: ${elapsedMs}ms`);
    console.log(`[EMAIL] Provider: Resend`);
    console.log(`========================================\n`);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: response.id,
      provider: 'Resend',
      email,
      ticketId,
      elapsedMs,
    });

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`\n❌ [EMAIL] CRITICAL ERROR (${elapsedMs}ms):`);
    console.error(`[EMAIL] Error: ${errorMessage}`);
    console.error(`[EMAIL] Stack:`, error);
    console.error(`========================================\n`);

    res.status(500).json({
      success: false,
      error: `Email sending failed: ${errorMessage}`,
      ticketId: req.body?.ticketId,
      provider: 'Resend',
    });
  }
});

/**
 * GET /api/send-ticket-email/health
 * Check if Resend service is ready
 */
router.get('/health', (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  console.log('[Health Check] API Key:', apiKey ? '✅ Present' : '❌ Missing');
  console.log('[Health Check] From Email:', fromEmail || '❌ Missing');
  
  res.json({
    status: apiKey ? 'healthy' : 'not-configured',
    provider: 'Resend',
    configured: !!apiKey,
    apiKeyPresent: !!apiKey,
    fromEmailSet: !!fromEmail,
  });
});

export default router;
