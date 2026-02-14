import {
  Home, Search, Ticket, ShoppingBag, LayoutDashboard, Shield, ScanLine, Plus,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useWallet } from "@/contexts/WalletContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const publicItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Discover Events", url: "/events", icon: Search },
  { title: "Resale Market", url: "/resale", icon: ShoppingBag },
];

const buyerItems = [
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

export function AppSidebar() {
  const { isConnected, hasRole } = useWallet();

  return (
    <Sidebar className="border-r border-border/50" collapsible="icon">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-wider">
            Explore
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isConnected && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-wider">
              My Wallet
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {buyerItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-muted/50 transition-colors"
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isConnected && (hasRole("organizer") || hasRole("admin")) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-wider">
              Organizer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {organizerItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-muted/50 transition-colors"
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isConnected && hasRole("admin") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-wider">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-muted/50 transition-colors"
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
