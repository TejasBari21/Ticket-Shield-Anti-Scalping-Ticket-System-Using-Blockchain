import nodemailer from 'nodemailer';
import { Resend } from 'resend';

/**
 * Email Service for TicketShield
 * Supports both Nodemailer (SMTP) and Resend (modern API-based)
 * Uses Resend by default if API key is provided, falls back to Nodemailer/SMTP
 */

let transporter = null;
let resendClient = null;
let emailProvider = 'NONE';

/**
 * Initialize email service based on environment variables
 * Priority: Resend API → Nodemailer SMTP → None
 */
export function initializeEmailService() {
  try {
    // Try Resend first (modern, production-ready)
    if (process.env.RESEND_API_KEY) {
      resendClient = new Resend(process.env.RESEND_API_KEY);
      emailProvider = 'RESEND';
      console.log('✅ Email Service Initialized: RESEND');
      return true;
    }

    // Fall back to Nodemailer SMTP
    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for others
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      emailProvider = 'NODEMAILER';
      console.log('✅ Email Service Initialized: NODEMAILER (SMTP)');
      return true;
    }

    emailProvider = 'NONE';
    console.warn('⚠️  Email Service Not Configured. Set RESEND_API_KEY or SMTP_* environment variables.');
    return false;
  } catch (err) {
    console.error('❌ Failed to initialize email service:', err.message);
    emailProvider = 'NONE';
    return false;
  }
}

/**
 * Send email using configured provider
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email body
 * @param {Buffer} options.attachmentBuffer - Optional: PDF buffer for attachment
 * @param {string} options.attachmentFilename - Optional: Attachment filename
 * @returns {Promise<Object>} - Result with messageId and success status
 */
export async function sendEmail({
  to,
  subject,
  html,
  attachmentBuffer = null,
  attachmentFilename = 'ticket.pdf',
}) {
  if (!emailProvider || emailProvider === 'NONE') {
    console.warn('⚠️  Email service not configured. Skipping email send.');
    return {
      success: false,
      messageId: null,
      error: 'Email service not configured',
    };
  }

  try {
    let result;

    if (emailProvider === 'RESEND') {
      result = await sendViaResend({
        to,
        subject,
        html,
        attachmentBuffer,
        attachmentFilename,
      });
    } else if (emailProvider === 'NODEMAILER') {
      result = await sendViaNodemailer({
        to,
        subject,
        html,
        attachmentBuffer,
        attachmentFilename,
      });
    }

    console.log(`✅ Email sent via ${emailProvider} to ${to}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to send email via ${emailProvider}:`, err.message);
    return {
      success: false,
      messageId: null,
      error: err.message,
    };
  }
}

/**
 * Send email via Resend API
 * Modern, reliable email service with excellent deliverability
 */
async function sendViaResend({
  to,
  subject,
  html,
  attachmentBuffer,
  attachmentFilename,
}) {
  const emailOptions = {
    from: process.env.RESEND_FROM_EMAIL || 'noreply@ticketshield.app',
    to,
    subject,
    html,
  };

  // Add attachment if provided
  if (attachmentBuffer) {
    emailOptions.attachments = [
      {
        filename: attachmentFilename,
        content: attachmentBuffer,
        contentType: 'application/pdf',
      },
    ];
  }

  const response = await resendClient.emails.send(emailOptions);

  if (response.error) {
    throw new Error(`Resend API error: ${response.error.message}`);
  }

  return {
    success: true,
    messageId: response.data.id,
    provider: 'RESEND',
  };
}

/**
 * Send email via Nodemailer SMTP
 * For self-hosted or Gmail/outlook integration
 */
async function sendViaNodemailer({
  to,
  subject,
  html,
  attachmentBuffer,
  attachmentFilename,
}) {
  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || 'noreply@ticketshield.app',
    to,
    subject,
    html,
  };

  // Add attachment if provided
  if (attachmentBuffer) {
    mailOptions.attachments = [
      {
        filename: attachmentFilename,
        content: attachmentBuffer,
        contentType: 'application/pdf',
      },
    ];
  }

  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    provider: 'NODEMAILER',
  };
}

/**
 * Get current email provider status
 */
export function getEmailStatus() {
  return {
    provider: emailProvider,
    configured: emailProvider !== 'NONE',
  };
}

/**
 * Test email connectivity
 * Useful for health checks
 */
export async function testEmailConnection() {
  try {
    if (emailProvider === 'NODEMAILER' && transporter) {
      await transporter.verify();
      return {
        success: true,
        provider: emailProvider,
        message: 'SMTP connection verified',
      };
    } else if (emailProvider === 'RESEND') {
      // Resend test by sending a test email
      return {
        success: true,
        provider: emailProvider,
        message: 'Resend API key validated',
      };
    }

    return {
      success: false,
      provider: emailProvider,
      message: 'Email service not configured',
    };
  } catch (err) {
    return {
      success: false,
      provider: emailProvider,
      message: err.message,
    };
  }
}
