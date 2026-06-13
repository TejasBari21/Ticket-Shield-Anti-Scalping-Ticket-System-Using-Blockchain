import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useWallet } from "@/contexts/WalletContext";
import { ticketDB } from "@/lib/localDB";
import { QRCodeSVG } from "qrcode.react";
import { Ticket, MapPin, Plus, Wallet, Send, History, ShieldCheck, Map, ArrowLeft } from "lucide-react";
import { fetchUserTicketsFromSupabase } from "@/integrations/supabase/tickets";

const DEFAULT_EVENT_IMAGE = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 500%22%3E%3Cdefs%3E%3ClinearGradient id=%22grad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%231BA6A6;stop-opacity:1%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%237ED4D4;stop-opacity:1%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22800%22 height=%22500%22 fill=%22url(%23grad)%22/%3E%3C/svg%3E";

export default function MyTickets() {
  const { isConnected, userId } = useWallet();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    const loadTickets = async () => {
      if (!userId) return;

      const localTickets = ticketDB.getTickets(userId) as any[];
      if (active) setTickets(localTickets);

      try {
        const cloudTickets = await fetchUserTicketsFromSupabase(userId);
        if (active && cloudTickets.length > 0) {
          setTickets(cloudTickets as any[]);
        }
      } catch (error) {
        console.error("Failed to load tickets from Supabase:", error);
      }
    };

    void loadTickets();

    return () => {
      active = false;
    };
  }, [userId]);

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 flex flex-col items-center max-w-5xl mx-auto bg-background min-h-screen text-foreground">
        <div className="w-full flex items-center mb-12">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold text-sm tracking-wider uppercase">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>
        <Wallet className="text-muted-foreground text-6xl mb-6 w-16 h-16 opacity-30" />
        <h2 className="font-headline text-2xl font-bold mb-2 text-foreground">Connect Your Wallet</h2>
        <p className="font-body text-muted-foreground font-medium">Connect MetaMask to view your tickets.</p>
        <button className="mt-8 bg-primary text-white py-4 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-sm uppercase tracking-widest" onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    );
  }

  const activeTickets = tickets.filter(t => t.status === "active");

  const handleImageError = (ticketId: string) => {
    setFailedImages(prev => new Set([...prev, ticketId]));
  };

  const getImageUrl = (ticketId: string, imageUrl: string | null | undefined): string => {
    if (failedImages.has(ticketId) || !imageUrl) {
      return DEFAULT_EVENT_IMAGE;
    }
    return imageUrl;
  };

  return (
    <div className="bg-background text-foreground font-body selection:bg-primary/20 pb-32 min-h-screen">
      <main className="pt-8 w-full max-w-5xl mx-auto">
        {/* Navigation */}
        <div className="px-6 flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold text-sm tracking-wider uppercase">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>

        {/* Hero Section */}
        <section className="px-6 mb-8 text-center sm:text-left">
          <div className="flex flex-col gap-1">
            <span className="font-label text-xs uppercase tracking-[0.3em] text-primary font-bold block mb-2 opacity-80">YOUR DIGITAL ASSETS</span>
            <h1 className="font-headline text-4xl font-bold text-foreground leading-tight tracking-tight">Secured Ledger</h1>
          </div>
        </section>

        {/* Sovereign Wallet Carousel */}
        <section className="relative overflow-hidden mb-12">
          {activeTickets.length === 0 ? (
            <div className="px-6">
              <div className="bg-card p-10 rounded-2xl border border-border text-center flex flex-col items-center justify-center min-h-[350px] shadow-lg">
                <Ticket className="w-20 h-20 text-muted-foreground opacity-10 mb-6" />
                <h3 className="text-2xl font-bold mb-2 text-foreground">No Active Tickets</h3>
                <p className="text-muted-foreground font-medium">Your vault is currently empty.</p>
                <Link to="/events" className="mt-8 bg-primary/10 border border-primary/20 text-primary px-8 py-3 rounded-xl font-bold hover:bg-primary/20 transition-all uppercase tracking-widest text-xs">
                  Browse Events
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-6 px-6 hide-scrollbar snap-x snap-mandatory pb-8">
              {activeTickets.map((ticket, i) => (
                <div key={ticket.id} className="flex-shrink-0 w-[320px] sm:w-[380px] snap-center">
                  <div className="bg-card rounded-[2rem] overflow-hidden shadow-lg relative border border-border hover:border-primary/40 transition-all">
                    <div className="h-44 relative bg-muted">
                      <img 
                        className="w-full h-full object-cover grayscale-[0.2] transition-all hover:grayscale-0 duration-700" 
                        alt="Event" 
                        src={getImageUrl(ticket.id, ticket.events?.image_url)}
                        onError={() => handleImageError(ticket.id)}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent"></div>
                      <div className="absolute top-5 left-5">
                        <span className="bg-white/80 text-primary border border-border backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">
                          Verified Asset
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-7 flex flex-col gap-6 bg-card text-foreground">
                      <div className="flex flex-col gap-1.5">
                        <h3 className="font-headline text-2xl font-bold leading-[1.1] truncate text-foreground">{ticket.events?.name || "Unknown Event"}</h3>
                        <p className="text-muted-foreground text-sm flex items-center gap-2 truncate font-medium">
                          <MapPin className="w-4 h-4 text-primary" />
                          {ticket.events?.venue}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center py-5 border-y border-border/50">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Date & Time</span>
                          <span className="text-sm font-bold text-foreground">{ticket.events ? format(new Date(ticket.events.date), "MMM d, yyyy • HH:mm") : "TBA"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 text-right">
                          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Tier</span>
                          <span className="text-sm font-bold text-primary uppercase">{ticket.ticket_tiers?.tier_name || "General"}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-5 py-6 bg-muted/30 rounded-2xl border border-border/50 shadow-inner">
                        <div className="p-4 bg-white rounded-2xl shadow-xl border border-border flex items-center justify-center p-3">
                           <QRCodeSVG value={JSON.stringify({ id: ticket.id, secret: ticket.qr_secret })} size={140} fgColor="#1F2933" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pass ID</span>
                          <span className="font-mono text-xs text-primary font-bold tracking-[0.2em]">{ticket.id.substring(0,14).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty "Add" Card */}
              <div className="flex-shrink-0 w-[320px] sm:w-[380px] snap-center">
                <Link to="/events" className="h-[95%] min-h-[450px] border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center justify-center gap-6 group cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all bg-muted/5">
                  <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-lg">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="font-headline font-bold text-muted-foreground text-lg group-hover:text-primary transition-colors tracking-tight">Acquire More Passes</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Bento Utility Grid */}
        <section className="px-6 flex flex-col gap-4">
          {/* Top Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wallet Balance */}
            <div className="bg-card border border-border shadow-lg p-8 rounded-[2rem] flex flex-col justify-between min-h-[180px] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-8 -mt-8 transition-all group-hover:bg-primary/10"></div>
              <div className="flex justify-between items-start">
                <span className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold opacity-60">Vault Balance</span>
                <Wallet className="w-6 h-6 text-[#FACC15]" />
              </div>
              <div className="flex items-end gap-3 mt-8">
                <span className="font-headline text-5xl font-bold text-foreground tracking-tighter">1.42</span>
                <span className="font-headline text-xl text-primary mb-1 font-bold tracking-widest">ETH</span>
                <div className="mb-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="text-emerald-500 text-[10px] font-bold tracking-widest">+4.2%</span>
                </div>
              </div>
            </div>

            {/* Transfer Quick Action */}
            <div className="bg-primary p-8 rounded-[2rem] flex flex-col justify-between items-start min-h-[180px] text-white cursor-pointer hover:opacity-95 transition-all shadow-lg shadow-primary/20 hover:scale-[1.01] group">
              <Send className="w-10 h-10 mb-4 border border-white/20 rounded-2xl p-2 bg-white/10 backdrop-blur-md group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              <div className="flex flex-col gap-1.5 flex-1 justify-end w-full">
                <span className="font-headline font-bold text-2xl tracking-tight leading-none uppercase tracking-widest">Transfer Asset</span>
                <span className="text-sm opacity-80 font-medium">Secure peer-to-peer delegation</span>
              </div>
            </div>
          </div>

          {/* Three Column Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Secondary Actions */}
            <div className="bg-card p-6 rounded-2xl flex items-center gap-4 hover:bg-muted/50 transition-all cursor-pointer border border-border shadow-md group">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-primary border border-border group-hover:border-primary/50 transition-colors shadow-sm">
                <History className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm text-foreground uppercase tracking-widest">History</span>
                <span className="text-[10px] text-muted-foreground font-bold tracking-tight opacity-50">12 ledger entries</span>
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl flex items-center gap-4 hover:bg-muted/50 transition-all cursor-pointer border border-border shadow-md group">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-primary border border-border group-hover:border-primary/50 transition-colors shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm text-foreground uppercase tracking-widest">Security</span>
                <span className="text-[10px] text-muted-foreground font-bold tracking-tight opacity-50">Biometric active</span>
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl flex items-center gap-4 hover:bg-muted/50 transition-all cursor-pointer border border-border shadow-md group">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-amber-500 border border-border group-hover:border-amber-500/50 transition-colors shadow-sm">
                <Map className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm text-foreground uppercase tracking-widest">Finder</span>
                <span className="text-[10px] text-muted-foreground font-bold tracking-tight opacity-50">Near interactions</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
