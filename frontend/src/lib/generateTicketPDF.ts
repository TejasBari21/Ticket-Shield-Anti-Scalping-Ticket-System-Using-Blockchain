import jsPDF from "jspdf";
import CryptoJS from "crypto-js";
import { deriveQRToken } from "@/hooks/useDynamicQR";
import {
  formatTicketTimestamp,
  formatTicketDate,
  formatTicketTime,
} from "@/lib/ticketTimestamp";

/* =========================
   TYPES
========================= */

export interface TicketPDFData {
  ticketId: string;
  qrSecret: string;
  eventName: string;
  eventDate: string;
  venue: string;
  tierName: string;
  price: number;
  purchaseTx: string;
  tokenId: string;
  ownerWallet: string;
  purchasedAt: string;
  eventCode: string;
  imageUrl?: string | null;
  eventLocation?: string | null;
}

/* =========================
   UTILITIES
========================= */

function encryptValue(value: string) {
  return (
    "ENC-" +
    CryptoJS.SHA256(value)
      .toString()
      .substring(0, 10)
      .toUpperCase()
  );
}

function generateSerial(eventCode: string, ticketId: string) {
  return `TS-${eventCode}-${ticketId.slice(0, 6)}`;
}

async function qrToDataURL(content: string) {
  const QRCode = await import("qrcode");
  return QRCode.default.toDataURL(content, { width: 300 });
}

/* =========================
   THEME COLORS
========================= */

const COLORS = {
  primary: "#1BA6A6",
  secondary: "#7ED4D4",
  accent: "#CFEFEF",
  surface: "#F5F7F8",
  text: "#1F2933",
  textMuted: "#647787",
  border: "#E8EAED",
  success: "#22863A",
  white: "#FFFFFF",
};

/* =========================
   IMAGE HANDLER
========================= */

async function imageToDataURL(
  url?: string | null
): Promise<string | null> {
  if (!url || url.trim() === "") return null;

  try {
    const cacheUrl = url.includes("?")
      ? `${url}&t=${Date.now()}`
      : `${url}?t=${Date.now()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(cacheUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const blob = await res.blob();

      if (blob.size > 0) {
        return await new Promise((resolve) => {
          const reader = new FileReader();

          reader.onloadend = () => {
            resolve(reader.result as string);
          };

          reader.onerror = () => resolve(null);

          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (err) {
    console.warn("[PDF] Image fetch failed:", err);
  }

  return null;
}

/* =========================
   HELPER FUNCTIONS
========================= */

function hexToRgb(hex: string): [number, number, number] {
  const result =
    /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result) return [0, 0, 0];

  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function setFillColorFromHex(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setTextColorFromHex(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function drawDivider(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  color: string = COLORS.border,
  thickness = 0.3
) {
  const [r, g, b] = hexToRgb(color);

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(thickness);
  doc.line(x, y, x + width, y);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }

  return text;
}

/* =========================
   MAIN PDF GENERATOR
========================= */

export async function generateTicketPDF(
  ticket: TicketPDFData
) {
  if (!ticket.eventName || !ticket.venue) {
    throw new Error(
      "Invalid ticket data: Missing event name or venue"
    );
  }

  try {
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
    });

    const PAGE_W = 210;
    const PAGE_H = 297;

    const margin = 12;
    const cardX = margin;
    const cardY = 15;
    const cardW = PAGE_W - margin * 2;

    const contentPadding = 10;
    const contentX = cardX + contentPadding;
    const contentW = cardW - contentPadding * 2;

    /* Background */

    setFillColorFromHex(doc, COLORS.surface);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    /* Card */

    setFillColorFromHex(doc, COLORS.white);

    doc.roundedRect(
      cardX,
      cardY,
      cardW,
      270,
      6,
      6,
      "F"
    );

    const [r, g, b] = hexToRgb(COLORS.border);

    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);

    doc.roundedRect(
      cardX,
      cardY,
      cardW,
      270,
      6,
      6
    );

    let y = cardY + 5;

    /* Top Accent */

    setFillColorFromHex(doc, COLORS.primary);

    doc.rect(cardX, y, cardW, 3, "F");

    y += 4;

    /* Event Image */

    const imageData = await imageToDataURL(ticket.imageUrl);

    if (imageData) {
      try {
        let imgFormat: "JPEG" | "PNG" | "WEBP" = "JPEG";

        if (imageData.startsWith("data:image/png")) {
          imgFormat = "PNG";
        } else if (
          imageData.startsWith("data:image/webp")
        ) {
          imgFormat = "WEBP";
        }

        doc.addImage(
          imageData,
          imgFormat,
          contentX,
          y,
          contentW,
          38
        );
      } catch (err) {
        console.warn("[PDF] Failed to add image:", err);
      }
    }

    y += 42;

    /* Badges */

    const badgeY = y;

    setFillColorFromHex(doc, COLORS.success);

    doc.roundedRect(
      contentX,
      badgeY,
      24,
      6.5,
      1,
      1,
      "F"
    );

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");

    setTextColorFromHex(doc, COLORS.white);

    doc.text(
      "CONFIRMED",
      contentX + 12,
      badgeY + 4.2,
      {
        align: "center",
      }
    );

    setFillColorFromHex(doc, COLORS.primary);

    doc.roundedRect(
      contentX + 27,
      badgeY,
      26,
      6.5,
      1,
      1,
      "F"
    );

    doc.text(
      truncateText(
        ticket.tierName.toUpperCase(),
        10
      ),
      contentX + 40,
      badgeY + 4.2,
      {
        align: "center",
      }
    );

    y += 11;

    /* QR Section */

    drawDivider(doc, contentX, y, contentW);

    y += 6;

    const qrStartY = y;

    setFillColorFromHex(doc, COLORS.accent);

    doc.roundedRect(
      contentX,
      qrStartY - 2,
      contentW,
      56,
      4,
      4,
      "F"
    );

    const qrPayload = JSON.stringify({
      id: ticket.ticketId,
      token: encryptValue(ticket.tokenId),
    });

    const qrCode = await qrToDataURL(qrPayload);

    const qrSize = 42;

    const qrX =
      cardX + cardW / 2 - qrSize / 2;

    doc.addImage(
      qrCode,
      "PNG",
      qrX,
      qrStartY,
      qrSize,
      qrSize
    );

    doc.setFontSize(8);

    setTextColorFromHex(doc, COLORS.primary);

    doc.setFont("helvetica", "normal");

    doc.text(
      "Scan for entry • Refreshes every 30 seconds",
      cardX + cardW / 2,
      qrStartY + qrSize + 6,
      {
        align: "center",
        maxWidth: contentW,
      }
    );

    y = qrStartY + 64;

    /* Event Details */

    drawDivider(doc, contentX, y, contentW);

    y += 6;

    const eventDate = formatTicketDate(
      ticket.eventDate
    );

    const eventTime = formatTicketTime(
      ticket.eventDate
    );

    doc.setFontSize(8);

    doc.setFont("helvetica", "bold");

    setTextColorFromHex(doc, COLORS.textMuted);

    doc.text("EVENT DATE & TIME", contentX, y);

    y += 4;

    doc.setFontSize(11);

    setTextColorFromHex(doc, COLORS.primary);

    doc.text(eventDate, contentX, y);

    y += 4.5;

    doc.setFontSize(10);

    setTextColorFromHex(doc, COLORS.text);

    doc.text(eventTime, contentX, y);

    y += 7;

    /* Venue */

    doc.setFontSize(8);

    doc.setFont("helvetica", "bold");

    setTextColorFromHex(doc, COLORS.textMuted);

    doc.text("VENUE & LOCATION", contentX, y);

    y += 4;

    doc.setFontSize(10);

    doc.setFont("helvetica", "normal");

    setTextColorFromHex(doc, COLORS.text);

    doc.text(
      truncateText(ticket.venue, 35),
      contentX,
      y
    );

    if (ticket.eventLocation) {
      y += 4.5;

      doc.setFontSize(9);

      doc.text(
        truncateText(ticket.eventLocation, 35),
        contentX,
        y
      );
    }

    y += 8;

    /* Ticket Grid */

    drawDivider(doc, contentX, y, contentW);

    y += 6;

    const col1X = contentX;
    const col2X = contentX + contentW / 2 + 4;

    doc.setFontSize(8);

    doc.setFont("helvetica", "bold");

    setTextColorFromHex(doc, COLORS.textMuted);

    doc.text("TICKET ID", col1X, y);
    doc.text("PRICE", col2X, y);

    y += 4;

    doc.setFontSize(10);

    setTextColorFromHex(doc, COLORS.primary);

    doc.text(
      truncateText(ticket.ticketId, 14),
      col1X,
      y
    );

    doc.text(
      `ETH ${ticket.price.toLocaleString()}`,
      col2X,
      y
    );

    y += 6;

    doc.setFontSize(8);

    setTextColorFromHex(doc, COLORS.textMuted);

    doc.text("ISSUED AT", col1X, y);
    doc.text("TOKEN ID", col2X, y);

    y += 4;

    doc.setFontSize(8.5);

    setTextColorFromHex(doc, COLORS.text);

    let issuedAtText = ticket.purchasedAt;

    if (
      issuedAtText.startsWith("Booked on: ")
    ) {
      issuedAtText = issuedAtText.replace(
        "Booked on: ",
        ""
      );
    }

    doc.text(
      formatTicketTimestamp(issuedAtText),
      col1X,
      y
    );

    doc.text(
      truncateText(ticket.tokenId, 14),
      col2X,
      y
    );

    y += 8;

    /* Footer */

    drawDivider(doc, contentX, y, contentW);

    y += 5;

    const serial = generateSerial(
      ticket.eventCode,
      ticket.ticketId
    );

    doc.setFontSize(7);

    setTextColorFromHex(doc, COLORS.textMuted);

    const walletShort = `${ticket.ownerWallet.slice(
      0,
      8
    )}...${ticket.ownerWallet.slice(-6)}`;

    const txShort = `${ticket.purchaseTx.slice(
      0,
      12
    )}...`;

    doc.text(`Serial: ${serial}`, contentX, y);

    y += 3.5;

    doc.text(
      `Wallet: ${walletShort}`,
      contentX,
      y
    );

    y += 3.5;

    doc.text(`TX: ${txShort}`, contentX, y);

    y += 7;

    /* Security Message */

    drawDivider(doc, contentX, y, contentW);

    y += 4;

    doc.setFontSize(7);

    setTextColorFromHex(doc, COLORS.primary);

    doc.text(
      "This NFT ticket is secured on the Ethereum blockchain. QR code updates every 30 seconds.",
      cardX + cardW / 2,
      y,
      {
        align: "center",
        maxWidth: contentW,
      }
    );

    /* Save PDF */

    const filename = `Ticket-${ticket.ticketId}.pdf`;

    doc.save(filename);

    return doc;
  } catch (error) {
    console.error(
      "[PDF] Critical error during PDF generation:",
      error
    );

    throw new Error(
      `PDF generation failed: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`
    );
  }
}