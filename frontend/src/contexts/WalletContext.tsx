import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { initializeContract } from "@/integrations/contracts/contractService";
import { auditLogDB } from "@/lib/localDB";
const contractAddress = (import.meta as any).env.VITE_CONTRACT_ADDRESS;
const ADMIN_ADDRESS = ((import.meta as any).env.VITE_ADMIN_ADDRESS as string | undefined)?.toLowerCase();
const USER_ADDRESS  = ((import.meta as any).env.VITE_USER_ADDRESS  as string | undefined)?.toLowerCase();

interface WalletContextType {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  userId: string | null;
  userRoles: string[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  refreshBalance: () => Promise<void>;
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
  logout: async () => {},
  hasRole: () => false,
  refreshBalance: async () => {},
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();
  const { appUser, signOut: authSignOut, updateWalletAddress } = useAuth();
  // Ref so event listeners always read the latest roles without re-subscribing
  const userRolesRef = useRef<string[]>([]);
  useEffect(() => { userRolesRef.current = userRoles; }, [userRoles]);

  /** Returns an error message if `addr` is not allowed for the given roles, null otherwise. */
  const validateAddress = useCallback((addr: string, roles: string[]): string | null => {
    if (!ADMIN_ADDRESS) return null;
    const normalized = addr.toLowerCase();
    const isAdmin = roles.includes("admin");

    if (isAdmin) {
      // Admin role: only the admin wallet is allowed
      if (normalized !== ADMIN_ADDRESS) {
        return `Admin must connect with the admin wallet (${ADMIN_ADDRESS.slice(0, 6)}...${ADMIN_ADDRESS.slice(-4)}).`;
      }
    } else {
      // User role: admin wallet is blocked; if VITE_USER_ADDRESS is set, only that address is allowed
      if (normalized === ADMIN_ADDRESS) {
        return "Regular users cannot connect with the admin wallet.";
      }
      if (USER_ADDRESS && normalized !== USER_ADDRESS) {
        return `Please connect the designated user wallet (${USER_ADDRESS.slice(0, 6)}...${USER_ADDRESS.slice(-4)}).`;
      }
    }
    return null;
  }, []);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const bal = await provider.getBalance(addr);
      setBalance(parseFloat(formatEther(bal)).toFixed(4));
    } catch {
      setBalance(null);
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

    if (isConnecting) return; // prevent duplicate requests while one is pending

    setIsConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      // wallet_requestPermissions forces MetaMask to show the account picker every time
      // so the user can choose which account to use (not auto-connect to the last one).
      try {
        await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
      } catch (permErr: unknown) {
        // If the user cancels the account picker, surface the rejection cleanly
        const permCode = (permErr as any)?.code;
        if (permCode === 4001) {
          toast({ title: "Connection Cancelled", description: "You closed the account selector.", variant: "destructive" });
          return;
        }
        if (permCode === -32002) {
          toast({
            title: "MetaMask Pending",
            description: "A connection request is already open in MetaMask. Open MetaMask and approve or reject it.",
            variant: "destructive",
          });
          return;
        }
        // Fall through for other errors and let eth_accounts still run
      }
      const accounts: string[] = await provider.send("eth_accounts", []);

      const roles = userRolesRef.current;
      const validAccount = accounts.find((a) => !validateAddress(a, roles));

      if (!validAccount) {
        const isAdmin = roles.includes("admin");
        toast({
          title: "Wrong Wallet",
          description: isAdmin
            ? `Admin must use the designated admin wallet. Switch to it in MetaMask and try again.`
            : `Your MetaMask is showing the admin wallet. Switch to a regular account in MetaMask and try again.`,
          variant: "destructive",
        });
        return;
      }

      setAddress(validAccount);
      await fetchBalance(validAccount);
      // Pass the chosen address explicitly so the contract signer matches this wallet
      await initializeContract(contractAddress, validAccount);
      // Persist wallet address in Supabase users table
      await updateWalletAddress(validAccount);
      auditLogDB.log({ action: "wallet_connected", wallet: validAccount });
      toast({ title: "Wallet Connected", description: `${validAccount.slice(0, 6)}...${validAccount.slice(-4)}` });
    } catch (err: unknown) {
      const code = (err as any)?.code;
      if (code === 4001) {
        toast({ title: "Connection Rejected", description: "You rejected the wallet connection.", variant: "destructive" });
      } else {
        toast({ title: "Connection Failed", description: (err as Error).message, variant: "destructive" });
      }
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance, toast, isConnecting, validateAddress]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setBalance(null);
    toast({ title: "Wallet Disconnected" });
  }, [toast]);

  const logout = useCallback(async () => {
    setAddress(null);
    setBalance(null);
    setUserId(null);
    setUserRoles([]);
    userRolesRef.current = [];
    await authSignOut();
    toast({ title: "Logged out", description: "You have been signed out." });
  }, [toast, authSignOut]);

  const hasRole = useCallback((role: string) => userRoles.includes(role), [userRoles]);

  // Listen for MetaMask account changes
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
        return;
      }
      const newAddr = accounts[0];
      if (newAddr === address) return;
      // Validate new address against current role before accepting the switch
      const validationError = validateAddress(newAddr, userRolesRef.current);
      if (validationError) {
        disconnectWallet();
        toast({ title: "Wallet Mismatch", description: validationError, variant: "destructive" });
        return;
      }
      setAddress(newAddr);
      fetchBalance(newAddr);
      // Re-initialize with the new address so transactions are signed by the correct wallet
      await initializeContract(contractAddress, newAddr);
    };
    (window as any).ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      (window as any).ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [address, disconnectWallet, fetchBalance, validateAddress, toast]);

  // Restore session and MetaMask connection on mount
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const restoreWallet = async () => {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          const addr = accounts[0];
          if (!validateAddress(addr, userRolesRef.current)) {
            setAddress(addr);
            fetchBalance(addr);
          }
        }
      } catch {}
    };
    restoreWallet();
  }, [fetchBalance]);

  // Keep userId/roles in sync with the AuthContext appUser (backed by Supabase)
  useEffect(() => {
    if (appUser) {
      const newRoles = appUser.roles;
      // If the role changed, reset wallet so the correct one is reconnected fresh
      if (JSON.stringify(newRoles) !== JSON.stringify(userRolesRef.current)) {
        setAddress(null);
        setBalance(null);
      }
      setUserId(appUser.id);
      setUserRoles(newRoles);
      userRolesRef.current = newRoles;
    } else {
      // Signed out — clear everything
      setAddress(null);
      setBalance(null);
      setUserId(null);
      setUserRoles([]);
      userRolesRef.current = [];
    }
  }, [appUser]);

  // Auto-refresh balance every 15 s so incoming ETH (e.g. organizer payments) is reflected promptly
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => fetchBalance(address), 15_000);
    return () => clearInterval(id);
  }, [address, fetchBalance]);

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address);
  }, [address, fetchBalance]);

  return (
    <WalletContext.Provider value={{
      address, balance, isConnecting, isConnected: !!address,
      userId, userRoles, connectWallet, disconnectWallet, logout, hasRole, refreshBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
