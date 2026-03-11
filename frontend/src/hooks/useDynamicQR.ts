import { useState, useEffect, useCallback } from "react";

/** Duration of each QR code window in milliseconds (30 seconds) */
export const QR_WINDOW_MS = 30_000;

/**
 * Derive a short hex token from a ticket secret + time window index.
 * Uses the browser's native Web Crypto API (HMAC-SHA256).
 * The result is deterministic — same secret + window always gives the same token.
 */
export async function deriveQRToken(secret: string, windowIndex: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = new TextEncoder().encode(String(windowIndex));
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, message);
  // Return first 16 hex chars (64-bit) — compact but collision-resistant for this use-case
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * Verify a token against the current AND previous window to tolerate ≤30s clock drift.
 * Returns true when the token is valid.
 */
export async function verifyQRToken(
  secret: string,
  windowIndex: number,
  candidateToken: string,
): Promise<boolean> {
  const [current, previous] = await Promise.all([
    deriveQRToken(secret, windowIndex),
    deriveQRToken(secret, windowIndex - 1),
  ]);
  return candidateToken === current || candidateToken === previous;
}

export interface DynamicQRPayload {
  /** Supabase ticket id */
  ticketId: string;
  /** Current 30-second window index (Math.floor(Date.now() / QR_WINDOW_MS)) */
  window: number;
  /** HMAC token derived from the ticket secret + window */
  token: string;
}

export interface DynamicQRState {
  /** JSON string to encode into the QR code — changes every 30 seconds */
  qrValue: string;
  /** Seconds remaining in the current window (0-29) */
  secondsLeft: number;
  /** 0-to-1 fraction of the current window elapsed (for drawing a progress ring) */
  progress: number;
  /** Whether the token has been generated yet */
  ready: boolean;
}

/**
 * Hook: returns a rotating QR payload that refreshes every 30 seconds.
 *
 * @param ticketId  Supabase ticket UUID
 * @param qrSecret  The per-ticket secret stored in Supabase (never exposed in QR directly)
 * @param active    Pass false to skip generation when the dialog is closed
 */
export function useDynamicQR(
  ticketId: string,
  qrSecret: string | null,
  active: boolean,
): DynamicQRState {
  const [qrValue, setQrValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  const generate = useCallback(async () => {
    if (!qrSecret || !active) return;
    const now = Date.now();
    const windowIndex = Math.floor(now / QR_WINDOW_MS);
    const token = await deriveQRToken(qrSecret, windowIndex);
    const payload: DynamicQRPayload = { ticketId, window: windowIndex, token };
    setQrValue(JSON.stringify(payload));
    setReady(true);
  }, [ticketId, qrSecret, active]);

  // Regenerate immediately when opened, then every 30 s
  useEffect(() => {
    if (!active || !qrSecret) {
      setReady(false);
      setQrValue("");
      return;
    }
    generate();
    const interval = setInterval(generate, QR_WINDOW_MS);
    return () => clearInterval(interval);
  }, [active, qrSecret, generate]);

  // Update seconds-left + progress every second
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const elapsed = Date.now() % QR_WINDOW_MS;
      const remaining = Math.ceil((QR_WINDOW_MS - elapsed) / 1000);
      setSecondsLeft(remaining);
      setProgress(elapsed / QR_WINDOW_MS);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return { qrValue, secondsLeft, progress, ready };
}
