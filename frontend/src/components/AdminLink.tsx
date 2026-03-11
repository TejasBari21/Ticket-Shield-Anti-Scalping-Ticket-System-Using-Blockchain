/**
 * Admin Link Component
 * Shows admin control panel link only if user is admin
 * Works with both regular links and dropdown menus
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { checkAdminRole } from "@/integrations/contracts/adminService";
import { Shield } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui";

export function AdminLink() {
  const { address, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isConnected || !address) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const role = await checkAdminRole(address);
        setIsAdmin(role.isAdmin);
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [address, isConnected]);

  if (!isConnected || loading || !isAdmin) {
    return null;
  }

  return (
    <Link to="/admin/control" className="w-full">
      <DropdownMenuItem className="cursor-pointer flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span>Admin Control Panel</span>
      </DropdownMenuItem>
    </Link>
  );
}

/**
 * Admin Badge Component
 * Shows a small badge indicating user is admin
 */
export function AdminBadge() {
  const { address, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isConnected || !address) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        setChecking(true);
        const role = await checkAdminRole(address);
        setIsAdmin(role.isAdmin);
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [address, isConnected]);

  if (!isAdmin || checking) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
      <Shield className="h-3 w-3" />
      <span>Admin</span>
    </div>
  );
}

/**
 * Protected Admin Component
 * Wraps admin content and shows auth message if not admin
 */
interface ProtectedAdminProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedAdmin({ children, fallback }: ProtectedAdminProps) {
  const { address, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isConnected || !address) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const role = await checkAdminRole(address);
        setIsAdmin(role.isAdmin);
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [address, isConnected]);

  if (loading) {
    return <div className="p-4 text-center">Verifying admin access...</div>;
  }

  if (!isAdmin) {
    return (
      fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">You don't have admin access</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
