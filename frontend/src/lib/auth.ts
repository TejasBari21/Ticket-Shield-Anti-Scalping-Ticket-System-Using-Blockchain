/**
 * Supabase-backed auth service.
 * Uses Supabase Auth for signup/login/logout and stores user profiles
 * in the public.users table.
 */

import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = (import.meta as any).env.VITE_ADMIN_EMAIL as string ?? "adminfairpass@gmail.com";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthSession {
  user: AuthUser;
}

type AuthChangeCallback = (session: AuthSession | null) => void;

/** Fetch the role for a given Supabase user ID from public.users. */
async function fetchRole(userId: string): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role ?? "user";
}

function buildAuthUser(userId: string, email: string, role: string): AuthUser {
  return {
    id: userId,
    email,
    roles: role === "admin" ? ["admin"] : [],
  };
}

export const auth = {
  /** Sign in with email and password via Supabase Auth. */
  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password.trim(),
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Login failed. Please try again.");

    const role = await fetchRole(data.user.id);
    return buildAuthUser(data.user.id, data.user.email ?? "", role);
  },

  /**
   * Register a new user via Supabase Auth, then insert a row in public.users.
   * Returns the new AuthUser and a flag indicating if email confirmation is required.
   */
  async signUp(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser; needsEmailConfirmation: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Signup failed. Please try again.");

    const role = normalizedEmail === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    // Upsert the profile row — handles any race conditions with triggers
    const { error: dbError } = await supabase.from("users").upsert(
      {
        user_id: data.user.id,
        email: normalizedEmail,
        wallet_address: null,
        role,
      },
      { onConflict: "user_id" },
    );
    if (dbError) throw new Error(dbError.message);

    const needsEmailConfirmation = !data.session;
    return { user: buildAuthUser(data.user.id, normalizedEmail, role), needsEmailConfirmation };
  },

  /** Sign out the current user. */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Subscribe to Supabase Auth state changes.
   * Returns an unsubscribe function.
   */
  onAuthStateChange(callback: AuthChangeCallback): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        callback({ user: buildAuthUser(session.user.id, session.user.email ?? "", role) });
      } else {
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  },

  /** Fetch the current session asynchronously (used on app load). */
  async getSessionAsync(): Promise<AuthSession | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const role = await fetchRole(session.user.id);
    return { user: buildAuthUser(session.user.id, session.user.email ?? "", role) };
  },

  /** Admin only: fetch all users from public.users. */
  async getAllUsers(): Promise<Array<{ id: string; email: string }>> {
    const { data } = await supabase.from("users").select("user_id, email");
    return (data ?? []).map((u) => ({ id: u.user_id, email: u.email }));
  },

  /** Persist the connected wallet address for the current user. */
  async updateWalletAddress(userId: string, walletAddress: string): Promise<void> {
    await supabase
      .from("users")
      .update({ wallet_address: walletAddress })
      .eq("user_id", userId);
  },
};


/**
 * Deterministic password hash (DJB2 → hex).
 * Not a substitute for bcrypt in production, but prevents plaintext storage.
 */
function hashPassword(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
  }
  return "hashed:" + (h >>> 0).toString(16).padStart(8, "0");
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}
