import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Plus, Ticket, DollarSign, Users, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface OrgEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  status: string;
  category: string | null;
  ticket_tiers: { total_supply: number; remaining_supply: number; price: number }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-neon-green/20 text-neon-green",
  cancelled: "bg-destructive/20 text-destructive",
  completed: "bg-primary/20 text-primary",
};

const OrganizerDashboard = () => {
  const { userId, isConnected } = useWallet();
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("events")
        .select("*, ticket_tiers(total_supply, remaining_supply, price)")
        .eq("organizer_id", userId)
        .order("created_at", { ascending: false });
      setEvents((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const totalTicketsSold = events.reduce((sum, e) =>
    sum + (e.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) || 0), 0);
  const totalRevenue = events.reduce((sum, e) =>
    sum + (e.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply) * t.price, 0) || 0), 0);

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20">
        <LayoutDashboard className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-muted-foreground">Connect MetaMask to access the organizer dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Organizer Dashboard</h1>
            <p className="text-muted-foreground">Manage your events and track sales</p>
          </div>
          <Button asChild className="gradient-primary hover:opacity-90 gap-2">
            <Link to="/organizer/create"><Plus className="h-4 w-4" /> Create Event</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Ticket, label: "Events", value: events.length },
            { icon: Users, label: "Tickets Sold", value: totalTicketsSold },
            { icon: DollarSign, label: "Revenue", value: `${totalRevenue.toFixed(4)} ETH` },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Events list */}
        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-24 animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 glass rounded-2xl">
            <Plus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Events Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
            <Button asChild className="gradient-primary"><Link to="/organizer/create">Create Event</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const sold = event.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) || 0;
              const total = event.ticket_tiers?.reduce((s, t) => s + t.total_supply, 0) || 0;
              return (
                <div key={event.id} className="glass rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-primary/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-lg">{event.name}</h3>
                      <Badge className={statusBadge[event.status] || ""}>{event.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "MMM d, yyyy")} · {event.venue} · {sold}/{total} sold
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm"><Link to={`/events/${event.id}`}><Eye className="h-4 w-4" /></Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to={`/organizer/edit/${event.id}`}><Edit className="h-4 w-4" /></Link></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OrganizerDashboard;
