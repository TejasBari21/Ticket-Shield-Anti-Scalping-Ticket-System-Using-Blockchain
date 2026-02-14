import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WalletContextType {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  userId: string | null;
  userRoles: string[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  hasRole: (role: string) => boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  balance: null,
  isConnecting: false,
  isConnected: false,
  userId: null,
  userRoles: [],
  connectWallet: async () => {},
  disconnectWallet: () => {},
  hasRole: () => false,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const bal = await provider.getBalance(addr);
      setBalance(parseFloat(formatEther(bal)).toFixed(4));
    } catch {
      setBalance(null);
    }
  }, []);

  const syncWithSupabase = useCallback(async (walletAddr: string) => {
    try {
      // Sign in anonymously or with a custom method
      // For demo, we use the wallet address as email workaround
      const email = `${walletAddr.toLowerCase()}@blocktix.wallet`;
      const password = walletAddr.toLowerCase(); // Simplified for demo

      // Try to sign in first
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Try to sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { wallet_address: walletAddr.toLowerCase() } },
        });

        if (signUpError) throw signUpError;
        if (signUpData.user) {
          setUserId(signUpData.user.id);
          // Create profile
          await supabase.from("profiles").insert({
            user_id: signUpData.user.id,
            wallet_address: walletAddr.toLowerCase(),
            display_name: `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`,
          });
          // Assign buyer role by default
          // Note: First user might need admin role set manually
        }
      } else if (signInData.user) {
        setUserId(signInData.user.id);
      }

      // Fetch roles
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.session.user.id);
        setUserRoles(roles?.map((r: any) => r.role) || []);
      }
    } catch (err) {
      console.error("Supabase sync error:", err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!(window as any).ethereum) {
      toast({
        title: "MetaMask not found",
        description: "Please install MetaMask to connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const addr = accounts[0];
      setAddress(addr);
      await fetchBalance(addr);
      await syncWithSupabase(addr);
      toast({ title: "Wallet Connected", description: `${addr.slice(0, 6)}...${addr.slice(-4)}` });
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance, syncWithSupabase, toast]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setUserId(null);
    setUserRoles([]);
    supabase.auth.signOut();
    toast({ title: "Wallet Disconnected" });
  }, [toast]);

  const hasRole = useCallback((role: string) => userRoles.includes(role), [userRoles]);

  // Listen for account changes
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
        fetchBalance(accounts[0]);
        syncWithSupabase(accounts[0]);
      }
    };
    (window as any).ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      (window as any).ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [address, disconnectWallet, fetchBalance, syncWithSupabase]);

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!(window as any).ethereum) return;
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          fetchBalance(accounts[0]);
          syncWithSupabase(accounts[0]);
        }
      } catch {}
    };
    checkConnection();
  }, [fetchBalance, syncWithSupabase]);

  return (
    <WalletContext.Provider value={{
      address, balance, isConnecting, isConnected: !!address,
      userId, userRoles, connectWallet, disconnectWallet, hasRole,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
