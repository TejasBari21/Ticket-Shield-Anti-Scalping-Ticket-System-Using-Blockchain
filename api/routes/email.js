import express from 'express';
import { sendEmail, getEmailStatus, testEmailConnection } from '../services/emailService.js';
import { generateConfirmationEmailHTML, generateConfirmationEmailText } from '../services/emailTemplate.js';
import { User } from '../models/User.js';

const router = express.Router();

/**
 * POST /api/email/send-ticket-confirmation
 * Send ticket confirmation email with optional PDF attachment
 * Called after successful ticket booking
 */
router.post('/send-ticket-confirmation', async (req, res) => {
  try {
    const {
      email,
      userId,
      userFirstName,
      eventName,
      eventDate,
      eventTime,
      venue,
      location,
      tierName,
      quantity,
      price,
      totalPrice,
      ticketId,
      purchaseDate,
      ticketPdfBuffer, // Optional: PDF buffer (binary data from ticket PDF)
      ticketUrl, // URL to view ticket in the app
    } = req.body;

    // Validation
    if (!email || !userFirstName || !eventName || !ticketId || !ticketUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, userFirstName, eventName, ticketId, ticketUrl',
      });
    }

    // Fetch user to check notification preferences and prevent duplicates
    const user = await User.findById(userId).lean();
    
    if (!user) {
      console.warn(`[Email] User not found for ID: ${userId}`);
      // Continue anyway - email might still be needed
    }

    // Check if email was already sent recently (within 5 minutes)
    if (user?.last_confirmation_email_sent) {
      const minutesSinceLast = (Date.now() - new Date(user.last_confirmation_email_sent).getTime()) / (1000 * 60);
      
      if (minutesSinceLast < 5) {
        console.warn(`[Email] Duplicate email attempt for user ${userId} detected (${minutesSinceLast.toFixed(1)} min since last send)`);
        return res.status(409).json({
          success: false,
          error: 'Duplicate email detected. Email already sent recently.',
          lastSent: user.last_confirmation_email_sent,
        });
      }
    }

    // Check if user has disabled email notifications
    if (user && user.email_notifications_enabled === false) {
      console.log(`[Email] Email notifications disabled for user ${userId}`);
      return res.status(403).json({
        success: false,
        error: 'Email notifications are disabled for this user',
      });
    }

    console.log(`[Email] Preparing confirmation email for ${email} (Ticket: ${ticketId})`);

    // Generate HTML and text versions of the email
    const htmlContent = generateConfirmationEmailHTML({
      userFirstName,
      eventName,
      eventDate,
      eventTime,
      venue,
      location,
      tierName,
      quantity: quantity || 1,
      price: price || '0',
      totalPrice: totalPrice || '0',
      ticketId,
      purchaseDate: purchaseDate || new Date().toLocaleString(),
      ticketUrl,
    });

    const textContent = generateConfirmationEmailText({
      userFirstName,
      eventName,
      eventDate,
      eventTime,
      venue,
      location,
      tierName,
      quantity: quantity || 1,
      price: price || '0',
      totalPrice: totalPrice || '0',
      ticketId,
      purchaseDate: purchaseDate || new Date().toLocaleString(),
      ticketUrl,
    });

    // Send email via configured provider (Resend or SMTP)
    const emailResult = await sendEmail({
      to: email,
      subject: `🎉 Your ${eventName} Ticket is Confirmed!`,
      html: htmlContent,
      attachmentBuffer: ticketPdfBuffer || null, // PDF attachment if provided
      attachmentFilename: `${eventName.replace(/\s+/g, '_')}_ticket_${ticketId.slice(-8)}.pdf`,
    });

    if (!emailResult.success) {
      console.error(`[Email] Failed to send email: ${emailResult.error}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to send confirmation email',
        details: emailResult.error,
      });
    }

    // Update user's email sent tracking (if user exists)
    if (user && userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          last_confirmation_email_sent: new Date(),
          $inc: { email_sent_count: 1 },
        });
        console.log(`[Email] User email tracking updated for ${userId}`);
      } catch (updateErr) {
        console.warn(`[Email] Failed to update user email tracking:`, updateErr.message);
        // Don't fail the response - email was already sent
      }
    }

    console.log(`✅ [Email] Confirmation email sent successfully to ${email} (MessageID: ${emailResult.messageId})`);

    res.json({
      success: true,
      message: 'Confirmation email sent successfully',
      messageId: emailResult.messageId,
      provider: emailResult.provider,
      email: email,
      ticketId: ticketId,
    });
  } catch (error) {
    console.error(`❌ [Email] Error in send-ticket-confirmation:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/email/status
 * Check email service status and configuration
 * Useful for health checks and frontend status indicators
 */
router.get('/status', async (req, res) => {
  try {
    const status = getEmailStatus();
    const connectionTest = await testEmailConnection();

    res.json({
      configured: status.configured,
      provider: status.provider,
      connection: {
        ...connectionTest,
      },
    });
  } catch (error) {
    res.status(500).json({
      configured: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/email/test
 * Send a test email
 * Useful for development and debugging
 */
router.post('/test', async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'testEmail is required',
      });
    }

    const testResult = await sendEmail({
      to: testEmail,
      subject: '🧪 TicketShield Email Service Test',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px;">
              <h2 style="color: #1BA6A6;">TicketShield Email Service Test</h2>
              <p style="color: #666;">If you're reading this, the email service is working correctly!</p>
              <p style="color: #999; font-size: 12px;">Test sent at: ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `,
    });

    res.json({
      success: testResult.success,
      messageId: testResult.messageId,
      email: testEmail,
      message: 'Test email sent successfully',
    });
  } catch (error) {
    console.error('[Email Test] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/email/preferences/:userId
 * Update user email notification preferences
 */
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email_notifications_enabled } = req.body;

    if (typeof email_notifications_enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'email_notifications_enabled must be a boolean',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { email_notifications_enabled },
      { new: true }
    ).select('email email_notifications_enabled');

    res.json({
      success: true,
      message: 'Email preferences updated',
      user: {
        email: user.email,
        email_notifications_enabled: user.email_notifications_enabled,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
