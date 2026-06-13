import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { localDB, ticketDB, LocalTicket, LocalEvent } from "@/lib/localDB";
import { format } from "date-fns";
import { Ticket, ScanLine, ArrowRight, Calendar, ArrowLeft } from "lucide-react";
import { fetchUserTicketsFromSupabase } from "@/integrations/supabase/tickets";

export default function UserDashboard() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<LocalTicket[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<LocalEvent | null>(null);

  useEffect(() => {
    let active = true;

    const loadTickets = async () => {
      if (!appUser) return;

      const localTickets = ticketDB.getTickets(appUser.id);
      if (active) setTickets(localTickets);

      try {
        const cloudTickets = await fetchUserTicketsFromSupabase(appUser.id);
        if (active && cloudTickets.length > 0) {
          setTickets(cloudTickets);
        }
      } catch (error) {
        console.error("Failed to load dashboard tickets from Supabase:", error);
      }
    };

    void loadTickets();

    const allEvents = localDB.getEvents({ status: "published" });
    if (allEvents.length > 0) {
      setFeaturedEvent(allEvents[0]);
    }

    return () => {
      active = false;
    };
  }, [appUser]);

  const activeTickets = tickets.filter(t => t.status === "active");
  const activeTicketsCount = activeTickets.length;
  const eventsAttended = tickets.filter(t => t.status === "used").length;

  return (
    <div className="bg-background min-h-screen flex flex-col font-body text-foreground">
      <main className="flex-grow p-6 lg:p-10 max-w-5xl mx-auto w-full">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold text-sm tracking-wider uppercase">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>
        
        {/* Hero / Greeting Section */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="font-label text-xs uppercase tracking-[0.2em] text-primary font-bold mb-2 block">DASHBOARD OVERVIEW</span>
              <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tighter text-foreground">
                Welcome back
              </h2>
            </div>
            <div className="flex gap-4">
              <div className="px-6 py-4 bg-card border border-border rounded-xl flex flex-col min-w-[140px] shadow-sm">
                <span className="font-label text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Active Tickets</span>
                <span className="font-headline text-3xl font-bold text-primary">{activeTicketsCount.toString().padStart(2, '0')}</span>
              </div>
              <div className="px-6 py-4 bg-card border border-border rounded-xl flex flex-col min-w-[140px] shadow-sm">
                <span className="font-label text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Events Attended</span>
                <span className="font-headline text-3xl font-bold text-[#FACC15]">{eventsAttended.toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action: My Tickets */}
          <Link to="/my-tickets" className="group relative overflow-hidden rounded-2xl aspect-[16/10] bg-card border border-border shadow-md p-8 flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
              <div>
                <Ticket className="text-primary w-10 h-10 mb-4" />
                <h3 className="font-headline text-2xl font-bold text-foreground">My Tickets</h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-[200px] font-medium">Access and manage your secured digital assets.</p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-primary font-label text-sm uppercase tracking-wider font-bold">
                View Vault <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

          {/* Action: Scan Ticket */}
          <Link to="/check-in" className="group relative overflow-hidden rounded-2xl aspect-[16/10] bg-card border border-border shadow-md p-8 flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-lg">
              <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent"></div>
              </div>
              <div>
                <ScanLine className="text-primary w-10 h-10 mb-4" />
                <h3 className="font-headline text-2xl font-bold text-foreground">Scan Ticket</h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-[200px] font-medium">Instant entry verification via blockchain protocol.</p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-primary font-label text-sm uppercase tracking-wider font-bold">
                Launch Scanner <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

          {/* Featured Event Card */}
          {featuredEvent && (
            <div className="md:col-span-2 relative h-[400px] rounded-3xl overflow-hidden group shadow-lg bg-card border border-border">
              <img 
                alt={featuredEvent.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                src={featuredEvent.image_url || "https://images.unsplash.com/photo-1540039155733-d7696d4eb98b?q=80&w=2669&auto=format&fit=crop"} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full flex flex-col md:flex-row md:items-end justify-between gap-6 text-[#1F2933]">
                <div className="max-w-[80%]">
                  <span className="bg-[#FACC15] text-[#1F2933] px-3 py-1 rounded-sm font-label text-[10px] font-black uppercase tracking-widest mb-3 inline-block shadow-md">TRENDING NOW</span>
                  <h3 className="font-headline text-4xl font-bold text-[#1F2933] tracking-tight">{featuredEvent.name}</h3>
                  <p className="text-[#6B7280] text-sm flex items-center gap-2 mt-2 font-medium">
                    <Calendar className="w-5 h-5 text-[#9CA3AF]" /> {format(new Date(featuredEvent.date), "MMM d, yyyy")} • {featuredEvent.venue}
                  </p>
                </div>
                <Link to={`/events/${featuredEvent.id}`} className="bg-primary text-white px-8 py-3.5 rounded-xl font-label font-bold text-sm uppercase tracking-wider hover:scale-[1.02] shadow-xl shadow-primary/20 transition-all shrink-0">
                  Book Tickets
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
