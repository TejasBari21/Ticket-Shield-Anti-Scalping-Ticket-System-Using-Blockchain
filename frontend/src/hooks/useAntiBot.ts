import { useRef } from "react";

/** Maximum number of purchase attempts allowed within the rate-limit window. */
const MAX_ATTEMPTS_PER_WINDOW = 5;
/** Rate-limit window in milliseconds (5 minutes). */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
/** Minimum time between any two purchase attempts from the same wallet (8 seconds). */
const MIN_BETWEEN_ATTEMPTS_MS = 8_000;
/** Minimum time the user must have had the page open before a purchase is allowed (2 seconds). */
const MIN_DWELL_TIME_MS = 2_000;

const ATTEMPT_LOG_KEY = "fairpass_antibot_attempts";

export type AttemptOutcome =
  | "pending"
  | "success"
  | "rate_limited"
  | "challenge_failed"
  | "cooldown"
  | "blocked";

export interface AntiBotCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Builds a lightweight, PII-free browser fingerprint by hashing a set of
 * stable browser properties using the DJB2 algorithm.
 */
function getBrowserFingerprint(): string {
  const raw = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? ""),
  ].join("|");

  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Reads the attempt log from sessionStorage (survives page reload within the tab,
 * cleared on tab close — so bots that close and reopen a tab are not rate-limited,
 * but simple F5 refreshes are handled correctly).
 */
function readAttemptLog(): { wallet: string; timestamp: number }[] {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPT_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAttemptLog(log: { wallet: string; timestamp: number }[]): void {
  // Trim entries older than the rate-limit window before saving
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  sessionStorage.setItem(ATTEMPT_LOG_KEY, JSON.stringify(log.filter((a) => a.timestamp >= cutoff)));
}

/**
 * useAntiBot — client-side anti-bot protections.
 * Attempt log persists across page reloads (sessionStorage) so F5-refresh bypasses are blocked.
 */
export function useAntiBot() {
  const pageLoadTime = useRef<number>(Date.now());

  function isDwellTimeSufficient(): boolean {
    return Date.now() - pageLoadTime.current >= MIN_DWELL_TIME_MS;
  }

  async function checkRateLimit(
    wallet: string,
    _userId: string,
    _eventId?: string,
    _tierId?: string,
  ): Promise<AntiBotCheckResult> {
    const walletLower = wallet.toLowerCase();
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
    const log = readAttemptLog();
    const recent = log.filter(
      (a) => a.wallet === walletLower && a.timestamp >= windowStart,
    );

    if (recent.length >= MAX_ATTEMPTS_PER_WINDOW) {
      const retryInSec = Math.ceil((recent[0].timestamp + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000);
      return { allowed: false, reason: `Too many attempts. Please wait ${retryInSec}s.` };
    }

    if (recent.length > 0) {
      const lastMs = recent[recent.length - 1].timestamp;
      const elapsed = Date.now() - lastMs;
      if (elapsed < MIN_BETWEEN_ATTEMPTS_MS) {
        const waitSec = Math.ceil((MIN_BETWEEN_ATTEMPTS_MS - elapsed) / 1000);
        return { allowed: false, reason: `Please wait ${waitSec}s before trying again.` };
      }
    }

    return { allowed: true };
  }

  async function logAttempt(
    wallet: string,
    _userId: string,
    _outcome: AttemptOutcome,
    _eventId?: string,
    _tierId?: string,
  ): Promise<void> {
    const log = readAttemptLog();
    log.push({ wallet: wallet.toLowerCase(), timestamp: Date.now() });
    writeAttemptLog(log);
  }

  return { checkRateLimit, logAttempt, isDwellTimeSufficient };
}
