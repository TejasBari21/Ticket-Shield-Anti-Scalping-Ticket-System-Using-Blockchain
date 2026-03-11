import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  Button,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  SidebarTrigger,
} from "@/components/ui";
import { Link, useNavigate } from "react-router-dom";

export const Header = () => {
  const { address, balance, isConnecting, isConnected, connectWallet, disconnectWallet, logout, userId } = useWallet();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/[0.06] h-16">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.svg"
              alt="FairPass logo"
              className="w-8 h-8 drop-shadow-lg group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-[filter]"
            />
            <span className="text-lg font-bold gradient-text hidden sm:block">FairPass</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="glass border-white/10 hover:border-primary/40 gap-2.5 h-9 px-3 transition-all hover:shadow-lg hover:shadow-primary/5">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="font-mono text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {balance && (
                    <span className="text-muted-foreground text-xs hidden sm:inline ml-1">
                      {balance} ETH
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong min-w-[200px]">
                <DropdownMenuItem className="font-mono text-xs text-muted-foreground px-3 py-2 cursor-default select-text">
                  {address}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={disconnectWallet} className="px-3 py-2 cursor-pointer">
                  <Wallet className="mr-2 h-4 w-4" />
                  Disconnect Wallet
                </DropdownMenuItem>
                {userId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive px-3 py-2 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : userId ? (
            // Logged in via email but MetaMask not yet connected
            <Button
              onClick={connectWallet}
              disabled={isConnecting}
              variant="outline"
              className="glass border-primary/30 hover:border-primary/60 gap-2 h-9 px-4 rounded-lg text-sm"
            >
              <Wallet className="h-4 w-4 text-primary" />
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </Button>
          ) : null}

          {/* Always-visible Sign Out when logged in via email */}
          {userId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
