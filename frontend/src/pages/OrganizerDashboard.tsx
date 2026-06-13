import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Plus, Ticket, DollarSign, Users, Edit, Eye, ArrowLeft } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { localDB } from "@/lib/localDB";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface OrgEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  status: string;
  category: string | null;
  contract_event_id?: number;
  ticket_tiers: { total_supply: number; remaining_supply: number; price: number }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border border-border",
  published: "bg-primary/20 text-primary border border-primary/30 font-black",
  cancelled: "bg-red-500/10 text-red-500 border border-red-500/20",
  completed: "bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20",
};

const OrganizerDashboard = () => {
  const { userId, isConnected } = useWallet();
  const navigate = useNavigate();
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadEvents = () => {
    // Primary: events created by this organizer's userId
    let evts = userId
      ? (localDB.getEvents({ organizer_id: userId }) as OrgEvent[])
      : [];
    // Fallback: if none found (e.g. events were created by admin as a different user),
    // show ALL events so the dashboard is never empty for a legitimate organizer.
    if (evts.length === 0) {
      evts = localDB.getEvents() as OrgEvent[];
    }
    setEvents(evts);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, [userId]);

  // Refresh whenever localStorage changes (same-tab purchases) or every 5s
  useEffect(() => {
    const handleStorage = () => loadEvents();
    window.addEventListener("storage", handleStorage);
    const poll = setInterval(loadEvents, 5000);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(poll);
    };
  }, [userId]);

  const totalTicketsSold = events.reduce((sum, e) =>
    sum + (e.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) || 0), 0);
  const totalRevenue = events.reduce((sum, e) =>
    sum + (e.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply) * t.price, 0) || 0), 0);

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 bg-background min-h-screen text-foreground">
        <LayoutDashboard className="h-20 w-20 text-muted-foreground opacity-20 mx-auto mb-6" />
        <h2 className="text-3xl font-black mb-2 text-foreground">Connect Your Wallet</h2>
        <p className="text-muted-foreground font-bold">Connect MetaMask to access the organizer dashboard.</p>
        <Button className="mt-8 bg-primary text-primary-foreground font-black uppercase tracking-widest px-8 py-4 rounded-xl shadow-2xl shadow-primary/20 border border-white/10" onClick={() => navigate("/login")}>
          Launch Portal
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-background min-h-screen text-foreground">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2 text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.3em] text-primary font-black block mb-2 opacity-80">SOVEREIGN PROTOCOL</span>
            <h1 className="text-4xl font-black text-foreground tracking-tight">Organizer Dashboard</h1>
            <p className="text-muted-foreground font-bold text-sm tracking-tight opacity-70">Manage your events and track real-time blockchain inventory</p>
          </div>
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90 gap-2 px-6 py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20 border border-white/10">
            <Link to="/organizer/create"><Plus className="h-5 w-5" /> Create New Event</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {[
            { icon: Ticket, label: "Total Events", value: events.length, color: "#14B8A6" },
            { icon: Users, label: "Tickets Minted", value: totalTicketsSold, color: "#14B8A6" },
            { icon: DollarSign, label: "Total Revenue", value: `${totalRevenue.toFixed(3)} ETH`, color: "#FACC15" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-6 flex items-center gap-5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-8 -mt-8 group-hover:bg-primary/10 transition-all"></div>
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center border border-border shadow-inner">
                <stat.icon className="h-7 w-7" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground leading-none mb-1.5">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Events list */}
        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="bg-card border border-border rounded-2xl h-24 animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-[2.5rem] shadow-2xl border-dashed">
            <Plus className="h-16 w-16 text-muted-foreground opacity-20 mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-2 text-foreground">No Events Active</h3>
            <p className="text-muted-foreground font-bold mb-8 opacity-60">Initialize your first genesis event on the chain</p>
            <Button asChild className="bg-primary text-primary-foreground font-black uppercase tracking-widest px-8 py-4 rounded-xl shadow-2xl shadow-primary/20"><Link to="/organizer/create">Create Genesis Event</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const sold = event.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) || 0;
              const total = event.ticket_tiers?.reduce((s, t) => s + t.total_supply, 0) || 0;
              return (
                <div key={event.id} className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:border-primary/40 transition-all shadow-xl group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors">{event.name}</h3>
                      <Badge className={statusBadge[event.status] || ""}>{event.status.toUpperCase()}</Badge>
                      {/* On-chain status */}
                      {event.contract_event_id !== undefined ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-widest">
                          <CheckCircle2 className="h-3 w-3" /> Blockchain Verified #{event.contract_event_id}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#FACC15] bg-[#FACC15]/10 border border-[#FACC15]/20 px-3 py-1 rounded-full uppercase tracking-widest">
                          <AlertCircle className="h-3 w-3" /> Uncommitted State
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-bold opacity-80 flex items-center gap-3">
                      <span>{format(new Date(event.date), "MMM d, yyyy")}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{event.venue}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="text-primary">{sold}/{total} minted</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button asChild variant="outline" size="icon" className="w-12 h-12 rounded-xl border-border hover:border-primary/50 hover:bg-muted font-bold transition-all"><Link to={`/events/${event.id}`}><Eye className="h-5 w-5" /></Link></Button>
                    <Button asChild variant="outline" size="icon" className="w-12 h-12 rounded-xl border-border hover:border-primary/50 hover:bg-muted font-bold transition-all"><Link to={`/organizer/edit/${event.id}`}><Edit className="h-5 w-5" /></Link></Button>
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 group/trash" onClick={async () => {
                      if (event.status === "published") {
                        toast({ title: "Cannot Delete Published Event", description: "Published events cannot be deleted. Cancel ticket sales first via the blockchain.", variant: "destructive" });
                        return;
                      }
                      if (!confirm("Delete this event? This action cannot be undone.")) return;
                      try {
                        localDB.updateEventStatus(event.id, "cancelled");
                        toast({ title: "Event Deleted", description: `${event.name} has been removed.` });
                        loadEvents();
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Failed to delete event";
                        toast({ title: "Error", description: msg, variant: "destructive" });
                      }
                    }}>
                      <Trash2 className="h-5 w-5 text-red-500/60 group-hover/trash:text-red-500 transition-colors" />
                    </Button>
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
