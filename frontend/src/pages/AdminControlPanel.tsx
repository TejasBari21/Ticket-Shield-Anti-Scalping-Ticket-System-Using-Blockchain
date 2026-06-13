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
  formatBalance,
} from "@/integrations/contracts/adminService";
import {
  Button, Input, Label,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Alert, AlertDescription,
} from "@/components/ui";
import { Shield, Wallet, DollarSign, Settings, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminControlPanel() {
  const { address, isConnected } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
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

        const role = await checkAdminRole(address);
        setAdminRole(role);

        const ownerData = await getContractOwner();
        setOwner(ownerData);

        const statsData = await getAdminStats();
        setStats(statsData);

      } catch (error) {
        console.error("Error loading admin data:", error);
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
      const newStats = await getAdminStats();
      setStats(newStats);
    } catch (error) {
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
      toast({ title: "Error", description: "Please enter a fee percentage", variant: "destructive" });
      return;
    }
    const percentage = parseFloat(newFeePercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 20) {
      toast({ title: "Error", description: "Fee must be between 0 and 20", variant: "destructive" });
      return;
    }

    try {
      setSettingFee(true);
      const txHash = await updatePlatformFee(percentage);
      toast({ title: "Success", description: `Platform fee updated to ${percentage}%. Transaction: ${txHash.slice(0, 10)}...` });
      setNewFeePercentage("");
      const newStats = await getAdminStats();
      setStats(newStats);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update platform fee", variant: "destructive" });
    } finally {
      setSettingFee(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 max-w-md mx-auto bg-background min-h-screen">
        <Shield className="h-16 w-16 text-[#9CA3AF]/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-[#1F2933]">Connect Your Wallet</h2>
        <p className="text-[#6B7280] mb-6 font-medium">
          You need to connect your MetaMask wallet to access the control panel.
        </p>
        <Button onClick={() => navigate("/login")} className="bg-[#1BA6A6] text-white">Go to Login</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center py-20 bg-background min-h-screen">
        <p className="text-[#6B7280] font-bold animate-pulse uppercase tracking-widest text-xs">Loading smart contract data...</p>
      </div>
    );
  }

  if (!adminRole?.isAdmin) {
    return (
      <div className="p-6 text-center py-20 max-w-md mx-auto bg-background min-h-screen text-foreground">
        <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-red-600">Not Authorized</h2>
        <p className="text-[#6B7280] mb-6 font-medium">
          Your wallet does not have admin privileges. Only the contract owner can access this panel.
        </p>
        {owner?.verified && (
          <div className="mt-4 p-4 bg-white border border-red-100 rounded-xl text-sm shadow-sm">
            <strong className="text-[#1F2933]">Contract Owner:</strong> <span className="font-mono text-red-600">{owner.address.slice(0, 10)}...{owner.address.slice(-8)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-[#1F2933] font-body relative overflow-hidden pb-28">
      {/* Subtle Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[20%] left-[-20%] w-[80%] h-[40%] bg-[#1BA6A6]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-[#7ED4D4]/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 p-6 md:p-8 max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1BA6A6] mb-1">Smart Contract Settings</p>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#1F2933]">Admin Control Panel</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2 bg-white border-[#E5E7EB] hover:bg-[#F5F7F8] text-[#6B7280] font-bold shadow-sm">
            <ArrowLeft className="h-4 w-4" /> To Main Console
          </Button>
        </div>

        {/* Status Card */}
        <div className="bg-white p-6 rounded-[1.5rem] border border-[#1BA6A6]/20 shadow-lg shadow-[#1BA6A6]/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#1BA6A6]/10 text-[#1BA6A6] flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1F2933]">Admin Authorized</p>
              <p className="text-xs text-[#6B7280] font-mono mt-1">{address}</p>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold">Role</p>
             <p className="font-bold text-[#1BA6A6] uppercase tracking-wider text-sm">{adminRole?.isOwner ? "Contract Owner" : "Admin"}</p>
          </div>
        </div>

        {/* Contract Details */}
        <div className="bg-white p-6 rounded-[1.5rem] space-y-4 border border-[#E5E7EB] shadow-sm">
          <h3 className="font-headline font-bold text-lg leading-tight text-[#1F2933]">Contract Details</h3>
          <div className="grid grid-cols-2 gap-4 border-t border-[#E5E7EB] pt-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-widest mb-1">Contract Address</p>
              <p className="font-mono text-sm text-[#1F2933]">{contractAddress?.slice(0, 15)}...</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-widest mb-1">Network</p>
              <p className="font-bold text-sm text-[#1F2933]">Chain ID: {stats?.chainId}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="financials" className="w-full">
          <TabsList className="bg-white p-1 rounded-xl mb-6 border border-[#E5E7EB] shadow-sm">
            <TabsTrigger value="financials" className="rounded-lg font-bold data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] text-[#6B7280]">Financials</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg font-bold data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] text-[#6B7280]">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="financials" className="space-y-6">
            <div className="bg-white p-6 rounded-[1.5rem] border border-[#E5E7EB] shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Wallet className="h-5 w-5 text-[#1BA6A6]" />
                <h3 className="font-headline font-bold text-lg leading-tight text-[#1F2933]">Contract Balance</h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-6 font-medium">Total funds and collected fees currently held in the smart contract.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-[#F5F7F8] border border-[#E5E7EB] p-5 rounded-xl shadow-inner">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1">Total Balance</p>
                  <p className="text-2xl font-bold text-[#1F2933]">
                    {stats ? formatBalance(stats.totalBalance) : "..."} ETH
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-xl shadow-inner">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Fees Collected</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {stats ? formatBalance(stats.feesCollected) : "..."} ETH
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E5E7EB] pt-6">
                <h3 className="font-bold mb-2 flex items-center gap-2 text-[#1F2933]">
                  <DollarSign className="h-4 w-4 text-[#1BA6A6]" />
                  Withdraw Fees
                </h3>
                <p className="text-sm text-[#6B7280] mb-4 font-medium">
                  Withdraw all collected platform fees to your admin wallet address.
                </p>
                <Button
                  onClick={handleWithdrawFees}
                  disabled={withdrawing || !stats || parseFloat(stats.feesCollected) === 0}
                  className="w-full h-12 rounded-xl bg-[#1BA6A6] text-white font-bold shadow-lg shadow-[#1BA6A6]/20 hover:opacity-90 transition-opacity"
                >
                  {withdrawing ? "Processing..." : "Withdraw Fees to Wallet"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="bg-white p-6 rounded-[1.5rem] border border-[#E5E7EB] shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="h-5 w-5 text-[#1BA6A6]" />
                <h3 className="font-headline font-bold text-lg leading-tight text-[#1F2933]">Platform Fee Settings</h3>
              </div>
              
              <div className="bg-[#F5F7F8] border border-[#E5E7EB] p-4 rounded-xl mb-6 shadow-inner">
                <p className="text-sm text-[#1F2933] font-bold">
                  Current Protocol Fee: <span className="font-mono text-[#1BA6A6]">{stats?.platformFeePercentage}%</span>
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <Label htmlFor="feePercentage" className="text-[#6B7280] font-bold uppercase tracking-widest text-[10px]">New Fee Percentage</Label>
                <div className="flex gap-2">
                  <Input
                    id="feePercentage"
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    placeholder="e.g. 5"
                    value={newFeePercentage}
                    onChange={(e) => setNewFeePercentage(e.target.value)}
                    className="h-12 bg-white border-[#E5E7EB] rounded-xl font-mono text-lg text-[#1F2933]"
                  />
                  <Button
                    onClick={handleUpdateFee}
                    disabled={settingFee || !newFeePercentage}
                    className="h-12 px-8 rounded-xl bg-[#1BA6A6] hover:opacity-90 text-white font-bold shadow-lg shadow-[#1BA6A6]/20"
                  >
                    {settingFee ? "Updating..." : "Update"}
                  </Button>
                </div>
                <p className="text-xs text-[#9CA3AF] font-medium">Fee must be between 0% and 20%.</p>
              </div>

              <Alert className="bg-[#1BA6A6]/5 border border-[#1BA6A6]/10 text-[#6B7280]">
                <AlertCircle className="h-4 w-4 text-[#1BA6A6]" />
                <AlertDescription className="text-xs font-medium">
                  The platform fee is automatically deducted from ticket sales. Event organizers receive the remaining amount.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
