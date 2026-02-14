import { Wallet, LogOut, ChevronDown, Menu } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";

export const Header = () => {
  const { address, balance, isConnecting, isConnected, connectWallet, disconnectWallet } = useWallet();

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-border/50 h-16">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">BT</span>
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">BlockTix</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="glass border-primary/30 hover:border-primary/60 gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="font-mono text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {balance && (
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      {balance} ETH
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong">
                <DropdownMenuItem className="font-mono text-xs text-muted-foreground">
                  {address}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={disconnectWallet} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={connectWallet}
              disabled={isConnecting}
              className="gradient-primary hover:opacity-90 transition-opacity neon-glow gap-2"
            >
              <Wallet className="h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
