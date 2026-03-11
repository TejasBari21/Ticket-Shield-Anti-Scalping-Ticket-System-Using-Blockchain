import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const ADMIN_EMAIL: string =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? "adminfairpass@gmail.com";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  /** ["admin"] for admins, [] for regular users. */
  roles: string[];
  walletAddress: string | null;
}

interface SignUpResult {
  user: AppUser;
  /** True when the Supabase project requires email confirmation before the session is active. */
  needsEmailConfirmation: boolean;
}

interface AuthContextType {
  /** Raw Supabase session — null when logged out. */
  session: Session | null;
  /** Enriched user object (with role + wallet) derived from the session. */
  appUser: AppUser | null;
  /** True while the initial session is being fetched from Supabase on app load. */
  sessionLoading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Persist the wallet address for the currently logged-in user. */
  updateWalletAddress: (walletAddress: string) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  session: null,
  appUser: null,
  sessionLoading: true,
  signIn: async () => {
    throw new Error("AuthContext not initialized");
  },
  signUp: async () => {
    throw new Error("AuthContext not initialized");
  },
  signOut: async () => {},
  updateWalletAddress: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchUserRecord(
  userId: string,
): Promise<{ role: string; wallet_address: string | null }> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const query = supabase
      .from("users")
      .select("role, wallet_address")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => data);
    const data = await Promise.race([query, timeout]);
    return { role: data?.role ?? "user", wallet_address: data?.wallet_address ?? null };
  } catch {
    return { role: "user", wallet_address: null };
  }
}

function buildAppUser(
  userId: string,
  email: string,
  role: string,
  walletAddress: string | null,
): AppUser {
  return {
    id: userId,
    email,
    roles: role === "admin" ? ["admin"] : [],
    walletAddress,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  /** Determine role instantly from email (no DB needed), then optionally refresh from DB. */
  const quickBuildUser = (s: Session): AppUser =>
    buildAppUser(
      s.user.id,
      s.user.email ?? "",
      (s.user.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user",
      null,
    );

  /** Hydrate from DB in the background and update appUser if role/wallet differ. */
  const hydrateUserFromDB = (s: Session) => {
    fetchUserRecord(s.user.id).then(({ role, wallet_address }) => {
      setAppUser((prev) =>
        prev ? { ...prev, roles: role === "admin" ? ["admin"] : [], walletAddress: wallet_address } : prev,
      );
    });
  };

  useEffect(() => {
    // 1. Restore persisted session on app load syncronously from localStorage cache
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          const user = quickBuildUser(session);
          setAppUser(user);
          hydrateUserFromDB(session);
        }
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));

    // 2. React to future auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Set user immediately from session data — no DB wait
        const user = quickBuildUser(session);
        setAppUser(user);
        setSessionLoading(false);
        // Refresh role/wallet from DB in the background
        hydrateUserFromDB(session);
      } else {
        setAppUser(null);
        setSessionLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password.trim(),
    });
    if (error) throw new Error(error.message);
    if (!data.user || !data.session) throw new Error("Login failed. Please try again.");

    // Build the AppUser immediately from session data — no extra DB round-trip.
    // onAuthStateChange fires in parallel and will refresh role/wallet from DB.
    const role = (data.user.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";
    const user = buildAppUser(data.user.id, data.user.email ?? "", role, null);
    setSession(data.session);
    setAppUser(user);
    return user;
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Signup failed. Please try again.");

    const role = normalizedEmail === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    // Insert profile row — upsert handles any post-signup triggers that may have already created it
    // Non-fatal: if the table doesn't exist yet the Auth user is still created successfully
    await supabase.from("users").upsert(
      { user_id: data.user.id, email: normalizedEmail, wallet_address: null, role },
      { onConflict: "user_id" },
    );

    const user = buildAppUser(data.user.id, normalizedEmail, role, null);
    const needsEmailConfirmation = !data.session;

    if (data.session) {
      setSession(data.session);
      setAppUser(user);
    }

    return { user, needsEmailConfirmation };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAppUser(null);
  };

  const updateWalletAddress = async (walletAddress: string) => {
    if (!session?.user) return;
    const { error } = await supabase
      .from("users")
      .update({ wallet_address: walletAddress })
      .eq("user_id", session.user.id);
    if (!error) {
      setAppUser((prev) => (prev ? { ...prev, walletAddress } : null));
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, appUser, sessionLoading, signIn, signUp, signOut, updateWalletAddress }}
    >
      {children}
    </AuthContext.Provider>
  );
};
