import { useState, useEffect } from "react";
import {
  Home, Search, Ticket, ShoppingBag, LayoutDashboard, Shield, ScanLine, Plus, ShieldCheck,
  Wallet, TrendingUp, ArrowDownToLine, Loader2, Plug, RefreshCw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useWallet } from "@/contexts/WalletContext";
import { localDB } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
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
  { title: "My Tickets", url: "/my-tickets", icon: Ticket },
  { title: "KYC Verification", url: "/kyc", icon: ShieldCheck },
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
    <SidebarGroupLabel className="text-muted-foreground/50 text-[10px] uppercase tracking-[0.15em] font-semibold px-3 mb-1">
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
                className="hover:bg-white/[0.04] transition-all duration-200 rounded-lg mx-1 px-3 py-2"
                activeClassName="bg-primary/10 text-primary border-l-2 border-primary shadow-sm shadow-primary/5"
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium text-sm">{item.title}</span>
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

  const calcStats = () => {
    const events = localDB.getEvents();
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
    calcStats();
    const handleStorage = () => calcStats();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    setIsRefreshing(false);
  };

  const handleWithdraw = () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Connect MetaMask first to withdraw funds.",
        variant: "destructive",
      });
      return;
    }
    if (revenue === 0) {
      toast({ title: "No funds to withdraw", description: "Total revenue is 0 ETH.", variant: "destructive" });
      return;
    }
    toast({
      title: "Withdrawal Initiated",
      description: `${revenue.toFixed(4)} ETH → ${address?.slice(0, 6)}…${address?.slice(-4)}`,
    });
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground/50 text-[10px] uppercase tracking-[0.15em] font-semibold px-3 mb-1">
        Admin Wallet
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="mx-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
          {isConnected ? (
            <>
              {/* Connected indicator + address */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {address?.slice(0, 7)}…{address?.slice(-5)}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Wallet className="h-3 w-3 text-blue-400" />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Balance</span>
                    </div>
                    <button
                      onClick={handleRefreshBalance}
                      disabled={isRefreshing}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold leading-none">
                    {balance ?? "—"}
                    <span className="text-[10px] text-muted-foreground ml-0.5">ETH</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Revenue</span>
                  </div>
                  <p className="text-sm font-semibold leading-none text-emerald-400">
                    {revenue.toFixed(3)}
                    <span className="text-[10px] text-muted-foreground ml-0.5">ETH</span>
                  </p>
                </div>
              </div>

              {/* Tickets sold row */}
              <div className="flex items-center justify-between text-xs border-t border-white/[0.05] pt-2">
                <span className="text-muted-foreground">Tickets Sold</span>
                <span className="font-semibold text-foreground">{ticketsSold}</span>
              </div>

              {/* Withdraw button */}
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors"
                onClick={handleWithdraw}
              >
                <ArrowDownToLine className="h-3 w-3 mr-1.5" />
                Withdraw Funds
              </Button>
            </>
          ) : (
            <div className="space-y-2.5">
              {/* Disconnected indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/30" />
                <span>Wallet not connected</span>
              </div>

              {/* Revenue preview (always visible) */}
              <div className="flex items-center justify-between text-xs rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  Revenue
                </span>
                <span className="font-semibold text-emerald-400">{revenue.toFixed(3)} ETH</span>
              </div>
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-muted-foreground">Tickets Sold</span>
                <span className="font-semibold text-foreground">{ticketsSold}</span>
              </div>

              {/* Connect button */}
              <Button
                size="sm"
                className="w-full h-7 text-xs"
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
    <Sidebar className="border-r border-white/[0.04]" collapsible="icon">
      <SidebarContent className="pt-4 space-y-1">
        <SidebarSection label="Explore" items={publicItems} />

        {/* Regular users only: My Tickets + KYC */}
        {isAuthenticated && !isAdmin && (
          <SidebarSection label="My Wallet" items={buyerItems} />
        )}

        {/* Organizer section: organizers and admins */}
        {isAuthenticated && (hasRole("organizer") || isAdmin) && (
          <SidebarSection label="Organizer" items={organizerItems} />
        )}

        {/* Admin controls */}
        {isAdmin && (
          <SidebarSection label="Admin" items={adminItems} />
        )}

        {/* Admin wallet / revenue panel */}
        {isAdmin && <AdminWalletSection />}
      </SidebarContent>
    </Sidebar>
  );
}
