import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { useContract } from "@/hooks/useContract";
import {
  getContractOwner,
  checkAdminRole,
  getAdminStats,
  withdrawFees,
  updatePlatformFee,
  getAdminDashboardData,
  formatBalance,
} from "@/integrations/contracts/adminService";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Alert, AlertDescription,
} from "@/components/ui";
import { Shield, Wallet, DollarSign, Settings, AlertCircle } from "lucide-react";

export default function AdminControlPanel() {
  const { address, isConnected } = useWallet();
  const { toast } = useToast();
  const contractAddress = (import.meta as any).env.VITE_CONTRACT_ADDRESS;

  const contract = useContract({
    contractAddress: contractAddress || "0x",
    autoInitialize: true,
  });

  const [adminRole, setAdminRole] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [newFeePercentage, setNewFeePercentage] = useState("");
  const [settingFee, setSettingFee] = useState(false);

  // Load admin data
  useEffect(() => {
    const loadAdminData = async () => {
      if (!isConnected || !address || !contract.initialized) return;

      try {
        setLoading(true);

        // Check admin role
        const role = await checkAdminRole(address);
        setAdminRole(role);

        // Get contract owner
        const ownerData = await getContractOwner();
        setOwner(ownerData);

        // Get stats
        const statsData = await getAdminStats();
        setStats(statsData);

        if (!role.isAdmin) {
          toast({
            title: "Not Authorized",
            description: "Your wallet is not an admin address",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error loading admin data:", error);
        toast({
          title: "Error",
          description: "Failed to load admin panel data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [isConnected, address, contract.initialized]);

  const handleWithdrawFees = async () => {
    if (!address) return;

    try {
      setWithdrawing(true);
      const txHash = await withdrawFees();
      toast({
        title: "Success",
        description: `Fees withdrawn. Transaction: ${txHash.slice(0, 10)}...`,
      });
      // Refresh stats
      const newStats = await getAdminStats();
      setStats(newStats);
    } catch (error) {
      console.error("Error withdrawing fees:", error);
      toast({
        title: "Error",
        description: "Failed to withdraw fees",
        variant: "destructive",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUpdateFee = async () => {
    if (!newFeePercentage) {
      toast({
        title: "Error",
        description: "Please enter a fee percentage",
        variant: "destructive",
      });
      return;
    }

    const percentage = parseFloat(newFeePercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 20) {
      toast({
        title: "Error",
        description: "Fee must be between 0 and 20",
        variant: "destructive",
      });
      return;
    }

    try {
      setSettingFee(true);
      const txHash = await updatePlatformFee(percentage);
      toast({
        title: "Success",
        description: `Platform fee updated to ${percentage}%. Transaction: ${txHash.slice(0, 10)}...`,
      });
      setNewFeePercentage("");
      // Refresh stats
      const newStats = await getAdminStats();
      setStats(newStats);
    } catch (error) {
      console.error("Error updating fee:", error);
      toast({
        title: "Error",
        description: "Failed to update platform fee",
        variant: "destructive",
      });
    } finally {
      setSettingFee(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Admin Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to access the admin panel</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Admin Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center">Loading admin data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!adminRole?.isAdmin) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Admin Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              You don't have admin privileges. Only the contract owner can access this panel.
            </AlertDescription>
          </Alert>
          {owner?.verified && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong>Contract Owner:</strong> {owner.address.slice(0, 10)}...{owner.address.slice(-8)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Admin Control Panel
        </h1>
        <p className="text-gray-600">Manage platform settings, fees, and monitor smart contract operations</p>
      </div>

      {/* Admin Status */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Shield className="h-5 w-5" />
            Admin Status: Authorized
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-gray-600">Your Wallet</p>
            <p className="font-mono text-sm">{address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Role</p>
            <p className="font-semibold">{adminRole?.isOwner ? "Contract Owner" : "Admin"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Contract Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Contract Address</p>
              <p className="font-mono text-xs">{contractAddress?.slice(0, 15)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Network</p>
              <p className="font-semibold">Chain ID: {stats?.chainId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different admin functions */}
      <Tabs defaultValue="financials" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Financials Tab */}
        <TabsContent value="financials" className="space-y-4">
          {/* Balance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Contract Balance
              </CardTitle>
              <CardDescription>Total funds and collected fees in the smart contract</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 mb-1">Total Balance</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {stats ? formatBalance(stats.totalBalance) : "..."} ETH
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 mb-1">Platform Fees Collected</p>
                    <p className="text-2xl font-bold text-green-700">
                      {stats ? formatBalance(stats.feesCollected) : "..."} ETH
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Withdraw Fees */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Withdraw Fees
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Withdraw all collected platform fees to your wallet
                </p>
                <Button
                  onClick={handleWithdrawFees}
                  disabled={withdrawing || !stats || parseFloat(stats.feesCollected) === 0}
                  className="w-full"
                >
                  {withdrawing ? "Processing..." : "Withdraw Fees"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          {/* Platform Fee Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Platform Fee Settings
              </CardTitle>
              <CardDescription>Configure the platform fee percentage (0-20%)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm">
                  <strong>Current Fee:</strong> <span className="font-mono">{stats?.platformFeePercentage}%</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feePercentage">New Fee Percentage</Label>
                <div className="flex gap-2">
                  <Input
                    id="feePercentage"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    placeholder="5"
                    value={newFeePercentage}
                    onChange={(e) => setNewFeePercentage(e.target.value)}
                  />
                  <Button
                    onClick={handleUpdateFee}
                    disabled={settingFee || !newFeePercentage}
                  >
                    {settingFee ? "Updating..." : "Update"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Fee must be between 0% and 20%</p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The platform fee is deducted from ticket sales. Organizers receive the remaining amount.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Additional Admin Info */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Admin Privileges:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Withdraw platform fees</li>
                  <li>Update platform fee percentage</li>
                  <li>View all events and tickets</li>
                  <li>Monitor contract balance</li>
                  <li>Access analytics and reports</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
