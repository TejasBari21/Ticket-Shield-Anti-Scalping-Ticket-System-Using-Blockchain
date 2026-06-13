import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL: string =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? "adminshield@gmail.com";

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
  /** True when email confirmation is needed before the account is active. */
  needsEmailConfirmation: boolean;
}

interface AuthContextType {
  /** Enriched user object (with role + wallet). */
  appUser: AppUser | null;
  /** True while the initial session is being fetched on app load. */
  sessionLoading: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Persist the wallet address for the currently logged-in user. */
  updateWalletAddress: (walletAddress: string) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
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

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function buildAppUser(user: User): AppUser {
  const walletAddress =
    typeof user.user_metadata?.walletAddress === "string"
      ? user.user_metadata.walletAddress
      : null;

  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    roles: isAdminEmail(email) ? ["admin"] : [],
    walletAddress: walletAddress || null,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  /** Restore session from Supabase and subscribe to auth state changes. */
  useEffect(() => {
    let active = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        setAppUser(session?.user ? buildAppUser(session.user) : null);
        setSessionLoading(false);

        if (timeoutId) clearTimeout(timeoutId);
      } catch (error) {
        // If session fetch fails, just set loading to false and continue
        console.warn("[Auth] Failed to restore session:", error);
        if (active) {
          setAppUser(null);
          setSessionLoading(false);
        }
      }
    };

    // Set a timeout to prevent the loading spinner from showing forever
    timeoutId = setTimeout(() => {
      if (active) {
        console.warn("[Auth] Session restore timeout - proceeding without session");
        setSessionLoading(false);
      }
    }, 5000); // 5 second timeout

    void bootstrap();

    let subscription;
    try {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setAppUser(session?.user ? buildAppUser(session.user) : null);
        setSessionLoading(false);
        if (timeoutId) clearTimeout(timeoutId);
      });
      subscription = sub;
    } catch (error) {
      console.warn("[Auth] Failed to subscribe to auth state:", error);
    }

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password.trim(),
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Login failed. Please try again.");

      const user = buildAppUser(data.user);
      setAppUser(user);
      return user;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Login failed. Please try again.");
    }
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password.trim(),
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Signup failed. Please try again.");

      const user = buildAppUser(data.user);
      const needsEmailConfirmation = !data.session;
      setAppUser(needsEmailConfirmation ? null : user);

      return { user, needsEmailConfirmation };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Signup failed. Please try again.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
  };

  const updateWalletAddress = async (walletAddress: string) => {
    if (!appUser) return;
    try {
      const { error } = await supabase.auth.updateUser({
        data: { walletAddress },
      });
      if (error) throw error;
      setAppUser((prev) => (prev ? { ...prev, walletAddress } : null));
    } catch (error) {
      console.error("Failed to update wallet address:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ appUser, sessionLoading, signIn, signUp, signOut, updateWalletAddress }}
    >
      {children}
    </AuthContext.Provider>
  );
};
