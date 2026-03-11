import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";

export type KYCStatus = "unverified" | "pending" | "approved" | "rejected";

export interface KYCSubmission {
  id: string;
  user_id: string;
  wallet_address: string;
  full_name: string;
  date_of_birth: string;
  country: string;
  id_type: string;
  status: KYCStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface SubmitKYCData {
  fullName: string;
  dateOfBirth: string;
  country: string;
  idType: string;
  idNumber: string;
}

const KYC_KEY = "fairpass_kyc";

function readKYCStore(): Record<string, KYCSubmission> {
  try {
    return JSON.parse(localStorage.getItem(KYC_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeKYCStore(store: Record<string, KYCSubmission>) {
  localStorage.setItem(KYC_KEY, JSON.stringify(store));
  window.dispatchEvent(new StorageEvent("storage", { key: KYC_KEY }));
}

/** Standalone status check — safe to call outside React (e.g. in route guards). */
export function getKYCStatusForUser(userId: string | null): KYCStatus {
  if (!userId) return "unverified";
  return readKYCStore()[userId]?.status ?? "unverified";
}

export function useKYC() {
  const { userId } = useWallet();
  const [submission, setSubmission] = useState<KYCSubmission | null>(
    userId ? (readKYCStore()[userId] ?? null) : null,
  );
  const [loading] = useState(false);

  // Sync when userId changes or localStorage changes
  useEffect(() => {
    if (!userId) { setSubmission(null); return; }
    setSubmission(readKYCStore()[userId] ?? null);
  }, [userId]);

  const kycStatus: KYCStatus = submission?.status ?? "unverified";

  const submitKYC = useCallback(
    async (data: SubmitKYCData): Promise<{ error?: string }> => {
      if (!userId) return { error: "Not logged in" };

      const now = new Date().toISOString();
      const record: KYCSubmission = {
        id: `kyc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: userId,
        wallet_address: (window as { ethereum?: { selectedAddress?: string } }).ethereum?.selectedAddress ?? "",
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        country: data.country,
        id_type: data.idType,
        status: "approved", // auto-approve for demo platform
        rejection_reason: null,
        submitted_at: now,
        reviewed_at: now,
      };

      const store = readKYCStore();
      store[userId] = record;
      writeKYCStore(store);
      setSubmission(record);
      return {};
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    setSubmission(readKYCStore()[userId] ?? null);
  }, [userId]);

  return { kycStatus, submission, loading, submitKYC, refresh };
}
