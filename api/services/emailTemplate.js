/**
 * Email Template Generator for TicketShield
 * Creates beautiful, responsive HTML emails matching the app's teal theme
 * Premium feel with modern design patterns
 */

/**
 * Generate ticket confirmation email HTML
 * Matches TicketShield's teal (#1BA6A6) brand colors
 * Includes event details, QR code placeholder, and CTA buttons
 */
export function generateConfirmationEmailHTML({
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
  ticketUrl,
}) {
  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = eventTime || '—';
  const formattedPrice = typeof price === 'number' ? price.toFixed(2) : price;
  const formattedTotal = typeof totalPrice === 'number' ? totalPrice.toFixed(2) : totalPrice;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Confirmation - TicketShield</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #1F2933;
      background: linear-gradient(135deg, #f5f7f8 0%, #ffffff 100%);
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(27, 166, 166, 0.08), 0 2px 4px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1BA6A6 0%, #0E8585 100%);
      padding: 40px 30px;
      text-align: center;
      color: #FFFFFF;
    }
    .header-logo {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 10px;
    }
    .header-subtitle {
      font-size: 18px;
      font-weight: 600;
      opacity: 0.95;
    }
    .emoji {
      font-size: 32px;
      margin: 0 8px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #1F2933;
      margin-bottom: 8px;
    }
    .greeting-subtext {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .ticket-visual {
      background: linear-gradient(135deg, #CFEFEF 0%, #E8F8F8 100%);
      border: 2px solid #1BA6A6;
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 32px;
      text-align: center;
    }
    .ticket-visual-header {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1BA6A6;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .event-title {
      font-size: 24px;
      font-weight: 700;
      color: #1F2933;
      margin-bottom: 20px;
      word-break: break-word;
    }
    .event-details {
      text-align: left;
      background: #FFFFFF;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .detail-row {
      display: flex;
      padding: 12px 0;
      border-bottom: 1px solid #F0F1F3;
      font-size: 14px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #6B7280;
      font-weight: 600;
      min-width: 100px;
      flex: 0 0 auto;
    }
    .detail-value {
      color: #1F2933;
      font-weight: 500;
      flex: 1;
      text-align: right;
    }
    .qr-placeholder {
      background: #F5F7F8;
      border: 2px dashed #1BA6A6;
      border-radius: 8px;
      padding: 20px;
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
      color: #6B7280;
    }
    .info-section {
      background: #F5F7F8;
      border-left: 4px solid #1BA6A6;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .info-title {
      font-size: 14px;
      font-weight: 700;
      color: #1F2933;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-text {
      font-size: 13px;
      color: #6B7280;
      line-height: 1.6;
    }
    .button-group {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .button {
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
      display: inline-block;
    }
    .button-primary {
      background: linear-gradient(135deg, #1BA6A6 0%, #0E8585 100%);
      color: #FFFFFF;
      flex: 1;
      min-width: 200px;
    }
    .button-primary:hover {
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(27, 166, 166, 0.3);
    }
    .button-secondary {
      background: #F0F1F3;
      color: #1BA6A6;
      flex: 1;
      min-width: 200px;
    }
    .button-secondary:hover {
      background: #E5E7EB;
    }
    .footer {
      background: #F5F7F8;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #E5E7EB;
    }
    .footer-text {
      font-size: 13px;
      color: #6B7280;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .footer-links {
      font-size: 12px;
    }
    .footer-links a {
      color: #1BA6A6;
      text-decoration: none;
      margin: 0 12px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    .divider {
      height: 1px;
      background: #E5E7EB;
      margin: 20px 0;
    }
    .badge {
      display: inline-block;
      background: #CFEFEF;
      color: #1BA6A6;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media (max-width: 600px) {
      .container {
        border-radius: 8px;
      }
      .content {
        padding: 28px 20px;
      }
      .header {
        padding: 30px 20px;
      }
      .footer {
        padding: 24px 20px;
      }
      .event-title {
        font-size: 20px;
      }
      .button-group {
        flex-direction: column;
      }
      .button {
        width: 100%;
        min-width: auto;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">TicketShield</div>
      <div class="header-subtitle">
        <span class="emoji">🎉</span>
        Your Ticket is Confirmed
        <span class="emoji">🎉</span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="content">
      <!-- Greeting -->
      <div class="greeting">Hey ${userFirstName || 'there'}! 👋</div>
      <div class="greeting-subtext">
        Your ticket has been successfully booked. We're excited to see you at the event!
      </div>

      <!-- Ticket Visual -->
      <div class="ticket-visual">
        <div class="ticket-visual-header">✓ Ticket Confirmed</div>
        <div class="event-title">${eventName}</div>
        
        <div class="event-details">
          <div class="detail-row">
            <div class="detail-label">📅 Date</div>
            <div class="detail-value">${formattedDate}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">🕐 Time</div>
            <div class="detail-value">${formattedTime}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">📍 Venue</div>
            <div class="detail-value">${venue}</div>
          </div>
          ${location ? `
          <div class="detail-row">
            <div class="detail-label">📌 Location</div>
            <div class="detail-value">${location}</div>
          </div>
          ` : ''}
          <div class="detail-row">
            <div class="detail-label">🎟️ Tier</div>
            <div class="detail-value"><span class="badge">${tierName}</span></div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Quantity</div>
            <div class="detail-value">× ${quantity}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Price</div>
            <div class="detail-value">${quantity > 1 ? `${formattedPrice} each` : formattedPrice} ETH</div>
          </div>
          <div class="detail-row" style="border-bottom: 2px solid #1BA6A6; padding-top: 16px;">
            <div class="detail-label" style="font-weight: 700;">Total</div>
            <div class="detail-value" style="color: #1BA6A6; font-weight: 700; font-size: 16px;">${formattedTotal} ETH</div>
          </div>
        </div>

        <div class="qr-placeholder">
          🔐 Your QR code is included in your ticket PDF
        </div>
      </div>

      <!-- Purchase Info -->
      <div class="info-section">
        <div class="info-title">📋 Purchase Details</div>
        <div class="info-text">
          <strong>Ticket ID:</strong> ${ticketId}<br>
          <strong>Purchased:</strong> ${purchaseDate}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="button-group">
        <a href="${ticketUrl}" class="button button-primary">View Your Ticket</a>
      </div>

      <!-- Important Info -->
      <div class="info-section" style="border-left-color: #FACC15;">
        <div class="info-title" style="color: #D97706;">⚠️ Important Information</div>
        <div class="info-text">
          ✓ Keep your ticket safe and secure<br>
          ✓ Show your QR code at the venue entrance<br>
          ✓ Ensure your wallet is connected at check-in<br>
          ✓ Tickets are non-transferable and NFT-locked<br>
          ✓ Resale available if enabled for this event
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">
        Questions or need help? Our support team is here for you.
      </div>
      <div class="footer-links">
        <a href="https://ticketshield.app">Visit TicketShield</a>
        <a href="https://ticketshield.app/support">Support</a>
        <a href="https://ticketshield.app/faq">FAQ</a>
      </div>
      <div class="divider"></div>
      <div class="footer-text" style="font-size: 12px;">
        TicketShield © 2026. All rights reserved.<br>
        This is an automated email. Please do not reply directly.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate a simple text fallback for email clients that don't support HTML
 */
export function generateConfirmationEmailText({
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
  ticketUrl,
}) {
  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
TICKETSHIELD - TICKET CONFIRMATION

Hey ${userFirstName || 'there'}!

Your ticket has been successfully booked. We're excited to see you at the event!

EVENT DETAILS
─────────────
Event: ${eventName}
Date: ${formattedDate}
Time: ${eventTime || '—'}
Venue: ${venue}
${location ? `Location: ${location}` : ''}
Ticket Tier: ${tierName}
Quantity: × ${quantity}
Price: ${price} ETH ${quantity > 1 ? '(each)' : ''}
Total: ${totalPrice} ETH

PURCHASE INFORMATION
──────────────────
Ticket ID: ${ticketId}
Purchased: ${purchaseDate}

VIEW YOUR TICKET
─────────────────
${ticketUrl}

IMPORTANT INFORMATION
────────────────────
✓ Keep your ticket safe and secure
✓ Show your QR code at the venue entrance
✓ Ensure your wallet is connected at check-in
✓ Tickets are non-transferable and NFT-locked
✓ Resale available if enabled for this event

Need help? Visit https://ticketshield.app/support

TicketShield © 2026. All rights reserved.
This is an automated email. Please do not reply directly.
  `.trim();
}
