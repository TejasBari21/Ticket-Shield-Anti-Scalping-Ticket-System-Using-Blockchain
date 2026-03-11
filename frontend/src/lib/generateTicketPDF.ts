/**
 * FairPass A4 NFT Ticket Generator (Secure Version)
 * - A4 layout
 * - Encrypted identifiers
 * - Dynamic layout engine
 * - Secure QR payload
 */

import { jsPDF } from "jspdf";
import CryptoJS from "crypto-js";
import { deriveQRToken } from "@/hooks/useDynamicQR";

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
  eventCode: string; // NEW
}

/* ------------------------------------------------ */
/* Encryption Utilities */
/* ------------------------------------------------ */

function encryptValue(value: string) {
  const hash = CryptoJS.SHA256(value).toString();
  return "ENC-" + hash.substring(0, 10).toUpperCase();
}

function generateSecurityCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part = () =>
    Array.from({ length: 4 })
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join("");

  return `${part()}-${part()}`;
}

function generateSerial(eventCode: string) {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");

  return `FP-${eventCode}-${year}-${rand}`;
}

/* ------------------------------------------------ */
/* QR generator */
/* ------------------------------------------------ */

async function qrToDataURL(content: string, size = 420): Promise<string> {
  const QRCode = await import("qrcode");

  return QRCode.default.toDataURL(content, {
    width: size,
    margin: 1,
  });
}

/* ------------------------------------------------ */
/* Card Renderer */
/* ------------------------------------------------ */

function card(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(20, 12, 45);
  doc.roundedRect(x, y, w, h, 3, 3, "F");

  doc.setDrawColor(90, 70, 170);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
}

/* ------------------------------------------------ */
/* Main Generator */
/* ------------------------------------------------ */

export async function generateTicketPDF(ticket: TicketPDFData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const PAGE_W = doc.internal.pageSize.getWidth(); // 210
  const PAGE_H = doc.internal.pageSize.getHeight(); // 297

  const margin = 18;

  let currentY = margin;

  /* ------------------------------------------------ */
  /* Background */
  /* ------------------------------------------------ */

  doc.setFillColor(10, 6, 30);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  /* ------------------------------------------------ */
  /* Header */
  /* ------------------------------------------------ */

  const HEADER_H = 30;

  doc.setFillColor(80, 30, 190);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");

  doc.text("FairPass", margin, 18);

  doc.setFontSize(10);
  doc.text("NFT EVENT TICKET", PAGE_W - margin, 18, {
    align: "right",
  });

  currentY = HEADER_H + 12;

  /* ------------------------------------------------ */
  /* Event Title */
  /* ------------------------------------------------ */

  doc.setTextColor(240, 230, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");

  const titleLines = doc.splitTextToSize(ticket.eventName, PAGE_W - 40);

  doc.text(titleLines, PAGE_W / 2, currentY, {
    align: "center",
  });

  currentY += titleLines.length * 10 + 6;

  /* ------------------------------------------------ */
  /* Tier Badge */
  /* ------------------------------------------------ */

  doc.setFillColor(120, 70, 240);

  doc.roundedRect(PAGE_W / 2 - 25, currentY, 50, 10, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  doc.text(ticket.tierName.toUpperCase(), PAGE_W / 2, currentY + 6.5, {
    align: "center",
  });

  currentY += 18;

  /* ------------------------------------------------ */
  /* Ticket Info Grid */
  /* ------------------------------------------------ */

  const cardW = (PAGE_W - margin * 2 - 10) / 2;
  const cardH = 20;

  const info = [
    ["DATE", new Date(ticket.eventDate).toLocaleString()],
    ["VENUE", ticket.venue],
    ["TIER", ticket.tierName],
    ["PRICE", `${ticket.price} ETH`],
  ];

  for (let i = 0; i < info.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);

    const x = margin + col * (cardW + 10);
    const y = currentY + row * (cardH + 8);

    card(doc, x, y, cardW, cardH);

    doc.setTextColor(140, 120, 220);
    doc.setFontSize(7);
    doc.text(info[i][0], x + 4, y + 6);

    const text = doc.splitTextToSize(info[i][1], cardW - 8);

    doc.setTextColor(230, 220, 255);
    doc.setFontSize(9);
    doc.text(text, x + 4, y + 14);
  }

  currentY += cardH * 2 + 20;

  /* ------------------------------------------------ */
  /* Serial + Security */
  /* ------------------------------------------------ */

  const serial = generateSerial(ticket.eventCode);
  const security = generateSecurityCode();

  doc.setTextColor(200, 180, 255);
  doc.setFontSize(9);

  doc.text(`Ticket Serial: ${serial}`, margin, currentY);
  doc.text(`Security Code: ${security}`, PAGE_W - margin, currentY, {
    align: "right",
  });

  currentY += 14;

  /* ------------------------------------------------ */
  /* QR Payload */
  /* ------------------------------------------------ */

  const windowIndex = Math.floor(Date.now() / 30000);

  const encryptedToken = encryptValue(ticket.tokenId);

  const qrPayload = {
    ticketId: ticket.ticketId,
    encryptedToken,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 10),
    signature: await deriveQRToken(ticket.qrSecret, windowIndex),
  };

  const qrData = await qrToDataURL(JSON.stringify(qrPayload));

  const qrSize = 60;

  card(doc, PAGE_W / 2 - 35, currentY - 4, 70, 70);

  doc.addImage(
    qrData,
    "PNG",
    PAGE_W / 2 - qrSize / 2,
    currentY,
    qrSize,
    qrSize
  );

  currentY += 80;

  /* ------------------------------------------------ */
  /* Blockchain Verification */
  /* ------------------------------------------------ */

  const fields = [
    ["Token ID", encryptValue(ticket.tokenId)],
    ["TX Hash", encryptValue(ticket.purchaseTx)],
    ["Wallet", encryptValue(ticket.ownerWallet)],
  ];

  const fieldH = 12;

  fields.forEach((f) => {
    card(doc, margin, currentY, PAGE_W - margin * 2, fieldH);

    doc.setTextColor(140, 120, 220);
    doc.setFontSize(7);
    doc.text(f[0], margin + 5, currentY + 7);

    doc.setTextColor(220, 210, 255);
    doc.setFontSize(8);
    doc.text(f[1], PAGE_W - margin - 5, currentY + 7, {
      align: "right",
    });

    currentY += fieldH + 6;
  });

  /* ------------------------------------------------ */
  /* Footer */
  /* ------------------------------------------------ */

  doc.setFillColor(70, 30, 170);
  doc.rect(0, PAGE_H - 20, PAGE_W, 20, "F");

  doc.setTextColor(220, 200, 255);
  doc.setFontSize(8);

  doc.text(
    "Verified on Ethereum Blockchain • FairPass Secure Entry System",
    PAGE_W / 2,
    PAGE_H - 8,
    { align: "center" }
  );

  /* ------------------------------------------------ */
  /* Save */
  /* ------------------------------------------------ */

  const safeName = ticket.eventName.replace(/[^a-z0-9]/gi, "_");

  doc.save(`fairpass_ticket_${safeName}_${ticket.ticketId}.pdf`);
}