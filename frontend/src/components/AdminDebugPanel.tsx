/**
 * Admin Status Debugger Component
 * Shows admin verification status and debugging info
 */

import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { checkAdminRole, getContractOwner } from "@/integrations/contracts/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Alert, AlertDescription, Badge } from "@/components/ui";
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

export function AdminDebugPanel() {
  const { address, isConnected } = useWallet();
  const contractAddress = (import.meta as any).env.VITE_CONTRACT_ADDRESS;
  const adminAddress = (import.meta as any).env.VITE_ADMIN_ADDRESS;

  const [adminRole, setAdminRole] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAdminStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isConnected || !address) {
        setError("Wallet not connected");
        return;
      }

      const [roleData, ownerData] = await Promise.all([
        checkAdminRole(address),
        getContractOwner(),
      ]);

      setAdminRole(roleData);
      setOwner(ownerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify admin status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAdminStatus();
  }, [address, isConnected]);

  return (
    <Card className="m-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-yellow-600" />
          Admin Status Debug
        </CardTitle>
        <CardDescription>Check your admin configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Status */}
        <div className="space-y-2">
          <p className="font-semibold text-sm">Wallet Status</p>
          <div className="pl-4 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Connected: {isConnected ? "Yes" : "No"}</span>
            </div>
            {address && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Address:</span>
                <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                  {address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Environment Configuration */}
        <div className="space-y-2">
          <p className="font-semibold text-sm">Environment Configuration</p>
          <div className="pl-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {contractAddress ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span>Contract Address: {contractAddress ? "✓ Set" : "✗ Missing"}</span>
            </div>
            {contractAddress && (
              <div className="text-xs font-mono bg-white px-2 py-1 rounded ml-6">
                {contractAddress.slice(0, 15)}...{contractAddress.slice(-15)}
              </div>
            )}
            <div className="flex items-center gap-2">
              {adminAddress ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <span>Admin Address: {adminAddress ? "✓ Set" : "⚠ Optional"}</span>
            </div>
            {adminAddress && (
              <div className="text-xs font-mono bg-white px-2 py-1 rounded ml-6">
                {adminAddress.slice(0, 15)}...{adminAddress.slice(-15)}
              </div>
            )}
          </div>
        </div>

        {/* Admin Role Status */}
        <div className="space-y-2">
          <p className="font-semibold text-sm">Admin Role Verification</p>
          {loading && <p className="text-sm text-gray-600 pl-4">Checking...</p>}
          {error && (
            <Alert variant="destructive" className="ml-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {adminRole && (
            <div className="pl-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {adminRole.isAdmin ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>Is Admin: {adminRole.isAdmin ? "Yes ✓" : "No ✗"}</span>
              </div>
              <div className="flex items-center gap-2">
                {adminRole.isOwner ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span>Is Contract Owner: {adminRole.isOwner ? "Yes ✓" : "No"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={adminRole.isAdmin ? "default" : "secondary"}>
                  Role: {adminRole.role.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Contract Owner Info */}
        {owner?.verified && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Contract Owner</p>
            <div className="pl-4 space-y-1 text-sm">
              <div className="text-xs font-mono bg-white px-2 py-1 rounded">
                {owner.address}
              </div>
              {address && address.toLowerCase() === owner.address.toLowerCase() && (
                <p className="text-green-600 text-xs font-semibold">✓ Your Address</p>
              )}
              {address && address.toLowerCase() !== owner.address.toLowerCase() && (
                <p className="text-red-600 text-xs font-semibold">✗ Different Address</p>
              )}
            </div>
          </div>
        )}

        {/* What to Do Next */}
        {!adminRole?.isAdmin && isConnected && address && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              <strong>To become admin:</strong>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Deploy smart contract with your wallet address</li>
                <li>Update VITE_CONTRACT_ADDRESS in .env</li>
                <li>Ensure you're connected to the correct network</li>
                <li>Refresh this page</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
