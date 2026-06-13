import { useState, useEffect } from "react";
import {
  Home, Search, Ticket, ShoppingBag, LayoutDashboard, Shield, ScanLine, Plus,
  Wallet, TrendingUp, Loader2, Plug, RefreshCw,
} from "lucide-react";
import { formatEther } from "ethers";
import { NavLink } from "@/components/NavLink";
import { useWallet } from "@/contexts/WalletContext";
import { localDB } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { getEvent } from "@/integrations/contracts/contractService";
import {
  Button,
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui";

const publicItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Discover Events", url: "/events", icon: Search },
  { title: "Resale Market", url: "/resale", icon: ShoppingBag },
];

const buyerItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Tickets", url: "/my-tickets", icon: Ticket },
];

const organizerItems = [
  { title: "Dashboard", url: "/organizer", icon: LayoutDashboard },
  { title: "Create Event", url: "/organizer/create", icon: Plus },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Shield },
  { title: "Check-in", url: "/check-in", icon: ScanLine },
];

const SidebarSection = ({ label, items }: { label: string; items: typeof publicItems }) => (
  <SidebarGroup>
    <SidebarGroupLabel className="text-[#6B7280]/60 text-[10px] uppercase tracking-[0.15em] font-bold px-3 mb-1">
      {label}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                end={item.url === "/"}
                className="hover:bg-[#F5F7F8] transition-all duration-200 rounded-lg mx-1 px-3 py-2 text-[#6B7280] flex items-center gap-3"
                activeClassName="bg-[#1BA6A6]/10 text-[#1BA6A6] font-bold shadow-sm shadow-[#1BA6A6]/5"
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm">{item.title}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

function AdminWalletSection() {
  const { address, balance, isConnected, isConnecting, connectWallet, refreshBalance } = useWallet();
  const { toast } = useToast();
  const [revenue, setRevenue] = useState(0);
  const [ticketsSold, setTicketsSold] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const calcStats = async () => {
    const events = localDB.getEvents();

    if (isConnected) {
      try {
        let onChainRevenueWei = 0n;
        let onChainSold = 0;

        for (const ev of events) {
          const contractEventId = (ev as any).contract_event_id;
          if (contractEventId === undefined || contractEventId === null) {
            continue;
          }

          const eventData: any = await getEvent(Number(contractEventId));
          const sold = BigInt(eventData?.ticketsSold ?? eventData?.[7] ?? 0);
          const basePrice = BigInt(eventData?.basePrice ?? eventData?.[8] ?? 0);

          onChainSold += Number(sold);
          onChainRevenueWei += sold * basePrice;
        }

        if (onChainSold > 0 || onChainRevenueWei > 0n) {
          setRevenue(Number(formatEther(onChainRevenueWei)));
          setTicketsSold(onChainSold);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch on-chain admin stats, falling back to local stats:", error);
      }
    }

    // Fallback for disconnected wallet or non-chain local events
    let totalRevenue = 0;
    let totalSold = 0;
    events.forEach((ev) => {
      ev.ticket_tiers.forEach((t) => {
        const sold = t.total_supply - t.remaining_supply;
        totalRevenue += sold * t.price;
        totalSold += sold;
      });
    });
    setRevenue(totalRevenue);
    setTicketsSold(totalSold);
  };

  useEffect(() => {
    void calcStats();
    const handleStorage = () => {
      void calcStats();
    };
    window.addEventListener("storage", handleStorage);
    const pollInterval = setInterval(() => {
      void calcStats();
    }, 5000);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(pollInterval);
    };
  }, [isConnected]);

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    setIsRefreshing(false);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[#6B7280]/60 text-[10px] uppercase tracking-[0.15em] font-bold px-3 mb-1">
        Admin Wallet
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="mx-2 rounded-xl border border-[#E5E7EB] bg-[#F5F7F8] p-3 space-y-3 shadow-inner">
          {isConnected ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 shadow-sm" />
                <span className="text-[10px] font-mono font-bold text-[#6B7280] truncate">
                  {address?.slice(0, 7)}…{address?.slice(-5)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-0 rounded-lg bg-white border border-[#E5E7EB] p-2 overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <Wallet className="h-3 w-3 text-blue-500 shrink-0" />
                      <span className="text-[9px] text-[#9CA3AF] font-bold uppercase tracking-wide truncate">Balance</span>
                    </div>
                    <button
                      onClick={handleRefreshBalance}
                      disabled={isRefreshing}
                      className="text-[#9CA3AF] hover:text-[#1BA6A6] transition-colors disabled:opacity-50 shrink-0 ml-1"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  <p className="text-sm font-bold leading-none truncate text-[#1F2933]">
                    {balance ?? "—"}
                    <span className="text-[10px] text-[#6B7280] ml-0.5 font-bold">ETH</span>
                  </p>
                </div>
                <div className="flex-1 min-w-0 rounded-lg bg-white border border-[#E5E7EB] p-2 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="text-[9px] text-[#9CA3AF] font-bold uppercase tracking-wide truncate">Revenue</span>
                  </div>
                  <p className="text-sm font-bold leading-none text-emerald-600 truncate">
                    {revenue.toFixed(3)}
                    <span className="text-[10px] text-[#6B7280] ml-0.5 font-bold">ETH</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs border-t border-[#E5E7EB] pt-2">
                <span className="text-[#6B7280] font-bold text-[10px] uppercase tracking-wider">Tickets Sold</span>
                <span className="font-bold text-[#1F2933]">{ticketsSold}</span>
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-[#6B7280] font-bold">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[#E5E7EB]" />
                <span className="text-[10px] uppercase tracking-wider">Wallet disconnected</span>
              </div>

              <div className="flex items-center justify-between text-xs rounded-lg bg-white border border-[#E5E7EB] px-2.5 py-2 shadow-sm">
                <span className="text-[#9CA3AF] flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-widest">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  Revenue
                </span>
                <span className="font-bold text-emerald-600 font-mono">{revenue.toFixed(3)} ETH</span>
              </div>
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-[#6B7280] font-bold text-[10px] uppercase tracking-wider">Tickets Sold</span>
                <span className="font-bold text-[#1F2933]">{ticketsSold}</span>
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs bg-white text-[#1BA6A6] border-[#1BA6A6] border bg-transparent hover:bg-[#1BA6A6]/5 font-bold"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Plug className="h-3 w-3 mr-1.5" />
                )}
                {isConnecting ? "Connecting…" : "Connect MetaMask"}
              </Button>
            </div>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { hasRole, userId } = useWallet();
  const isAdmin = hasRole("admin");
  const isAuthenticated = !!userId;

  return (
    <Sidebar className="border-r border-[#E5E7EB] bg-white" collapsible="icon">
      <SidebarContent className="pt-6 space-y-2">
        <SidebarSection label="Explore" items={publicItems} />

        {isAuthenticated && !isAdmin && (
          <SidebarSection label="My Wallet" items={buyerItems} />
        )}

        {isAuthenticated && (hasRole("organizer") || isAdmin) && (
          <SidebarSection label="Organizer" items={organizerItems} />
        )}

        {isAdmin && (
          <SidebarSection label="Admin" items={adminItems} />
        )}

        {isAdmin && <AdminWalletSection />}
      </SidebarContent>
    </Sidebar>
  );
}
