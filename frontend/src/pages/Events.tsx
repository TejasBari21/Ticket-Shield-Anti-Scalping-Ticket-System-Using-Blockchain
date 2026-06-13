import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isPast } from "date-fns";
import { localDB, LocalEvent } from "@/lib/localDB";
import { ArrowLeft, Search, Calendar, MapPin, Clock, ShieldCheck, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

const DEFAULT_EVENT_IMAGE = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 500%22%3E%3Cdefs%3E%3ClinearGradient id=%22grad%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%231BA6A6;stop-opacity:1%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%237ED4D4;stop-opacity:1%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22800%22 height=%22500%22 fill=%22url(%23grad)%22/%3E%3C/svg%3E";

function getMinPrice(tiers: LocalEvent["ticket_tiers"]): number {
  if (!tiers?.length) return 0;
  return Math.min(...tiers.map(t => t.price));
}

function getTotalLeft(tiers: LocalEvent["ticket_tiers"]): number {
  return tiers?.reduce((s, t) => s + t.remaining_supply, 0) ?? 0;
}

function getTotalCapacity(tiers: LocalEvent["ticket_tiers"]): number {
  return tiers?.reduce((s, t) => s + t.total_supply, 0) ?? 0;
}

function getFill(tiers: LocalEvent["ticket_tiers"]): number {
  const cap = getTotalCapacity(tiers);
  if (!cap) return 0;
  return Math.round(((cap - getTotalLeft(tiers)) / cap) * 100);
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "music", label: "Concerts" },
  { value: "sports", label: "Sports" },
  { value: "theater", label: "Theater" },
  { value: "general", label: "More" },
];

export default function Events() {
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState<LocalEvent[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      setAllEvents(localDB.getEvents({ status: "published" }));
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const filtered = useMemo(() => {
    let evts = [...allEvents];
    if (search.trim()) {
      const q = search.toLowerCase();
      evts = evts.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
      );
    }
    if (category !== "all") {
      evts = evts.filter(e => e.category === category || (category === "music" && e.category === "music") || (category === 'theater' && e.category === 'art'));
    }
    return evts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allEvents, search, category]);

  const trendingEvents = useMemo(() => {
    return [...allEvents]
      .filter(e => !isPast(new Date(e.date)))
      .sort((a, b) => getFill(b.ticket_tiers) - getFill(a.ticket_tiers))
      .slice(0, 1);
  }, [allEvents]);

  const handleImageError = (eventId: string) => {
    setFailedImages(prev => new Set([...prev, eventId]));
  };

  const getImageUrl = (eventId: string, imageUrl: string | null): string => {
    if (failedImages.has(eventId)) {
      return DEFAULT_EVENT_IMAGE;
    }
    return imageUrl || DEFAULT_EVENT_IMAGE;
  };

  return (
    <div className="bg-background text-foreground font-body min-h-[100dvh]">
      <main className="pt-8 pb-32 max-w-5xl mx-auto px-6 w-full">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold text-sm tracking-wider uppercase">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>

        <div className="mt-2 mb-12 flex flex-col items-center text-center">
          <h1 className="font-headline text-5xl font-bold tracking-tight text-foreground mb-8">Explore Events</h1>
          
          <div className="relative group mb-8 w-full max-w-xl">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input 
              className="w-full h-14 bg-card border border-border rounded-2xl pl-12 pr-4 text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm focus:border-primary/50" 
              placeholder="Artists, shows, venues..." 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORIES.map(c => (
              <button 
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap min-w-[80px] ${
                  category === c.value 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "bg-card border border-border text-muted-foreground hover:bg-muted active:bg-muted/80"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hot Trends / Featured */}
        {trendingEvents.length > 0 && search === "" && category === "all" && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">Hot Trends</h2>
              <button className="text-xs font-bold text-primary tracking-widest uppercase hover:underline">View All</button>
            </div>
            
            <Link to={`/events/${trendingEvents[0].id}`} className="block relative aspect-[4/5] md:aspect-[16/7] rounded-3xl overflow-hidden shadow-xl group active:scale-[0.98] transition-all duration-400">
              <img 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                src={getImageUrl(trendingEvents[0].id, trendingEvents[0].image_url)}
                alt={trendingEvents[0].name}
                onError={() => handleImageError(trendingEvents[0].id)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute inset-0 border border-white/5 rounded-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 p-8 w-full text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Trending Now</span>
                </div>
                <h3 className="font-headline text-4xl font-bold leading-[1.05] mb-4 tracking-tight">{trendingEvents[0].name}</h3>
                <div className="flex flex-wrap items-center gap-6 text-white/90 text-sm font-medium mb-8">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span>{format(new Date(trendingEvents[0].date), "MMM dd")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>{trendingEvents[0].venue}</span>
                  </div>
                </div>
                <div className="w-fit px-8 h-12 bg-white text-[#1F2933] font-bold rounded-xl shadow-xl hover:bg-white/90 flex items-center justify-center gap-2 transition-all">
                  Get Tickets
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Handpicked List */}
        <section className="mb-12">
          <div className="flex flex-col items-center text-center justify-between mb-8">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground mb-2">{search !== "" ? "Search Results" : "Handpicked for You"}</h2>
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">{filtered.length} available events</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(evt => {
              const minPrice = getMinPrice(evt.ticket_tiers);
              const isSellingFast = getFill(evt.ticket_tiers) > 80;
              
              return (
                <Link key={evt.id} to={`/events/${evt.id}`} className="block bg-card rounded-[2rem] overflow-hidden border border-border transition-all hover:shadow-lg active:scale-[0.98] group hover:border-primary/30 shadow-sm relative">
                  <div className="relative h-56 overflow-hidden bg-muted">
                    {!failedImages.has(evt.id) && evt.image_url ? (
                      <img 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        src={evt.image_url} 
                        alt={evt.name}
                        onError={() => handleImageError(evt.id)}
                        loading="lazy"
                      />
                    ) : (
                      <img 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        src={DEFAULT_EVENT_IMAGE} 
                        alt={evt.name}
                        loading="lazy"
                      />
                    )}
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-border flex flex-col items-center min-w-[56px] shadow-md">
                      <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">{format(new Date(evt.date), "MMM")}</span>
                      <span className="text-xl font-headline font-bold text-foreground">{format(new Date(evt.date), "dd")}</span>
                    </div>
                    {isSellingFast ? (
                       <div className="absolute top-4 right-4 bg-red-500 text-white border border-red-500/50 px-3 py-1.5 rounded-full shadow-lg">
                         <span className="text-[10px] font-bold uppercase tracking-widest">Selling Fast</span>
                       </div>
                    ) : (
                       <div className="absolute top-4 right-4 bg-primary/10 backdrop-blur-md border border-primary/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                         <ShieldCheck className="w-4 h-4 text-primary" />
                         <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Secured</span>
                       </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col justify-between h-[210px]">
                    <div>
                      <h3 className="font-headline text-xl font-bold text-foreground mb-3 line-clamp-1 group-hover:text-primary transition-colors">{evt.name}</h3>
                      <div className="flex flex-col gap-2 text-muted-foreground text-sm font-medium mb-5">
                        <div className="flex items-center gap-2 line-clamp-1">
                          <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                          <span className="truncate">{evt.venue}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Clock className="w-4 h-4 text-primary/60" />
                          <span>{format(new Date(evt.date), "hh:mm a")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Price From</span>
                        <span className="font-headline text-lg font-bold text-foreground">
                          {minPrice === 0 ? "Free" : `${minPrice} ETH`}
                        </span>
                      </div>
                      <button className="px-6 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-md shadow-primary/20">
                        View
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
            
          {filtered.length === 0 && (
            <div className="text-center py-24 opacity-60 flex flex-col items-center justify-center col-span-1 md:col-span-2 lg:col-span-3">
              <Search className="w-16 h-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-headline font-black mb-2 text-foreground">No events found</h3>
              <p className="text-sm font-bold text-muted-foreground mb-6">Try adjusting your category filter or search term.</p>
              <Button 
                variant="outline" 
                className="gap-2 border-primary/40 text-primary bg-primary/5 hover:bg-primary/20"
                onClick={() => {
                  localDB.seedDatabase();
                  window.location.reload();
                }}
              >
                <RefreshCw className="h-4 w-4" /> Restore Sample Events
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
