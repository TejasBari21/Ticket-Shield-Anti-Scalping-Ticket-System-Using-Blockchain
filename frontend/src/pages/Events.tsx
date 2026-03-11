import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Calendar, MapPin, Ticket, Sparkles, ArrowLeft,
  TrendingUp, Star, Clock, ChevronLeft, ChevronRight, Eye,
  Flame, Tag, X,
} from "lucide-react";
import { Input, Button, Progress, Dialog, DialogContent, DialogTitle } from "@/components/ui";
import { Link, useNavigate } from "react-router-dom";
import { localDB, LocalEvent } from "@/lib/localDB";
import { format, formatDistanceToNow, differenceInSeconds, isPast } from "date-fns";

// ─── Ratings helpers ──────────────────────────────────────────────────────────

interface RatingStore { [eventId: string]: { total: number; count: number } }

function readRatings(): RatingStore {
  try { return JSON.parse(localStorage.getItem("fairpass_ratings") || "{}"); } catch { return {}; }
}

function submitRating(eventId: string, stars: number): void {
  const r = readRatings();
  if (!r[eventId]) r[eventId] = { total: 0, count: 0 };
  r[eventId].total += stars;
  r[eventId].count += 1;
  localStorage.setItem("fairpass_ratings", JSON.stringify(r));
  window.dispatchEvent(new Event("fairpass_rating"));
}

function getAvg(store: RatingStore, id: string): { avg: number; count: number } {
  const e = store[id];
  if (!e || !e.count) return { avg: 0, count: 0 };
  return { avg: Math.round((e.total / e.count) * 10) / 10, count: e.count };
}

// ─── Event helpers ────────────────────────────────────────────────────────────

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

// ─── Status badges ────────────────────────────────────────────────────────────

type EvtBadge = "ended" | "live" | "almost-gone" | "hot" | "free" | "new";

const BADGE_CFG: Record<EvtBadge, { label: string; cls: string }> = {
  ended:         { label: "⏹ Ended",            cls: "bg-gray-500/20 text-gray-400 border border-gray-500/40" },
  live:          { label: "🔴 Live Now",        cls: "bg-red-500/20 text-red-300 border border-red-500/40" },
  "almost-gone": { label: "⚡ Almost Sold Out",  cls: "bg-orange-500/20 text-orange-300 border border-orange-500/40" },
  hot:           { label: "🔥 Hot Event",        cls: "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40" },
  free:          { label: "✅ Free",             cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" },
  new:           { label: "✨ New",              cls: "bg-primary/20 text-primary border border-primary/40" },
};

function getBadges(evt: LocalEvent): EvtBadge[] {
  // Events whose date has passed are marked as ended, not "Live Now"
  if (isPast(new Date(evt.date))) return ["ended"];
  const badges: EvtBadge[] = [];
  const fill = getFill(evt.ticket_tiers);
  const left  = getTotalLeft(evt.ticket_tiers);
  const ageMs = Date.now() - new Date(evt.created_at).getTime();
  if (fill >= 80 && left > 0) badges.push("almost-gone");
  else if (fill >= 50) badges.push("hot");
  if (getMinPrice(evt.ticket_tiers) === 0) badges.push("free");
  if (ageMs < 7 * 86_400_000) badges.push("new");
  return badges;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all",        label: "All Events",  emoji: "🌐" },
  { value: "music",      label: "Music",        emoji: "🎵" },
  { value: "sports",     label: "Sports",       emoji: "⚽" },
  { value: "tech",       label: "Tech",         emoji: "💻" },
  { value: "art",        label: "Art",          emoji: "🎨" },
  { value: "gaming",     label: "Gaming",       emoji: "🎮" },
  { value: "conference", label: "Conference",   emoji: "🎤" },
  { value: "general",    label: "General",      emoji: "📅" },
];

const CAT_GRAD: Record<string, string> = {
  music:      "from-violet-900/80 via-purple-800/50 to-black/60",
  sports:     "from-emerald-900/80 via-green-800/50 to-black/60",
  tech:       "from-cyan-900/80 via-blue-800/50 to-black/60",
  art:        "from-amber-900/80 via-yellow-800/50 to-black/60",
  gaming:     "from-rose-900/80 via-pink-800/50 to-black/60",
  conference: "from-indigo-900/80 via-blue-800/50 to-black/60",
  general:    "from-gray-900/80 via-slate-800/50 to-black/60",
};

const PAGE_SIZE = 9;

// ─── Countdown Timer ──────────────────────────────────────────────────────────

function CountdownTimer({ date }: { date: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const update = () => {
      const secs = differenceInSeconds(new Date(date), new Date());
      if (secs <= 0) { setLabel("Happening Now"); return; }
      const d = Math.floor(secs / 86400);
      const h = Math.floor((secs % 86400) / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      if (d >= 7) setLabel(formatDistanceToNow(new Date(date)));
      else if (d > 0) setLabel(`${d}d ${h}h ${m}m`);
      else setLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [date]);

  return <span className="font-mono text-amber-300 text-[11px]">{label}</span>;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ avg, count, interactive, onRate }: {
  avg: number;
  count: number;
  interactive?: boolean;
  onRate?: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(n)}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            className={`p-0 bg-transparent border-0 ${interactive ? "cursor-pointer" : "cursor-default"}`}
          >
            <Star className={`h-3 w-3 transition-colors ${n <= Math.round(hover || avg) ? "fill-amber-400 text-amber-400" : "text-white/15"}`} />
          </button>
        ))}
      </div>
      {count > 0 && (
        <span className="text-[10px] text-muted-foreground">{avg} ({count})</span>
      )}
    </div>
  );
}

// ─── Event Grid Card ──────────────────────────────────────────────────────────

function EventCard({ evt, ratingStore, onPreview, userRated, onRate }: {
  evt: LocalEvent;
  ratingStore: RatingStore;
  onPreview: (evt: LocalEvent) => void;
  userRated: Set<string>;
  onRate: (id: string, n: number) => void;
}) {
  const minPrice = getMinPrice(evt.ticket_tiers);
  const left     = getTotalLeft(evt.ticket_tiers);
  const fill     = getFill(evt.ticket_tiers);
  const badges   = getBadges(evt);
  const { avg, count } = getAvg(ratingStore, evt.id);
  const grad     = CAT_GRAD[evt.category] ?? CAT_GRAD.general;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.07] hover:border-primary/40 bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300 hover:shadow-[0_0_28px_rgba(99,102,241,0.14)]"
    >
      {/* ── Image area ── */}
      <div className="relative h-48 overflow-hidden">
        {evt.image_url ? (
          <img
            src={evt.image_url}
            alt={evt.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${grad}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Ticket className="h-14 w-14 text-white/[0.06]" />
            </div>
          </div>
        )}
        {/* Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Status badges (top-left) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {badges.slice(0, 2).map(b => (
            <span key={b} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${BADGE_CFG[b].cls}`}>
              {BADGE_CFG[b].label}
            </span>
          ))}
        </div>

        {/* Quick-preview eye button (top-right, shows on hover) */}
        <button
          type="button"
          onClick={e => { e.preventDefault(); onPreview(evt); }}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/40"
        >
          <Eye className="h-3.5 w-3.5 text-white/80" />
        </button>

        {/* Countdown (bottom-left) */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-2.5 py-1">
          <Clock className="h-3 w-3 text-amber-400/70" />
          <CountdownTimer date={evt.date} />
        </div>
      </div>

      {/* ── Card body ── */}
      <Link to={`/events/${evt.id}`} className="block p-4">
        {/* Category + Stars row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> {evt.category || "General"}
          </span>
          <StarRating
            avg={avg}
            count={count}
            interactive={!userRated.has(evt.id)}
            onRate={n => { onRate(evt.id, n); }}
          />
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
          {evt.name}
        </h3>

        <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-primary/50 shrink-0" />
            <span className="line-clamp-1">{format(new Date(evt.date), "MMM d, yyyy · h:mm a")}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-primary/50 shrink-0" />
            <span className="line-clamp-1">{evt.venue}{evt.location ? ` · ${evt.location}` : ""}</span>
          </div>
        </div>

        {/* Fill progress */}
        {getTotalCapacity(evt.ticket_tiers) > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>{fill}% filled</span>
              <span>{left} left</span>
            </div>
            <Progress value={fill} className="h-1" />
          </div>
        )}

        {/* Price row */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className={`font-mono font-bold text-sm ${minPrice === 0 ? "text-emerald-400" : "text-primary"}`}>
            {minPrice === 0 ? "Free" : `From ${minPrice} ETH`}
          </span>
          <span className="text-[10px] text-muted-foreground/70 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
            View →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Featured Card (hero strip) ───────────────────────────────────────────────

function FeaturedCard({ evt, ratingStore, index }: {
  evt: LocalEvent;
  ratingStore: RatingStore;
  index: number;
}) {
  const minPrice = getMinPrice(evt.ticket_tiers);
  const badges   = getBadges(evt);
  const { avg, count } = getAvg(ratingStore, evt.id);
  const grad     = CAT_GRAD[evt.category] ?? CAT_GRAD.general;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08 }}
      className="relative flex-shrink-0 w-[290px] md:w-[340px] rounded-2xl overflow-hidden border border-white/[0.08] hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_36px_rgba(99,102,241,0.2)] group cursor-pointer"
    >
      <Link to={`/events/${evt.id}`}>
        {/* Image */}
        <div className="h-52 relative overflow-hidden">
          {evt.image_url ? (
            <img src={evt.image_url} alt={evt.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${grad}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <Ticket className="h-16 w-16 text-white/[0.06]" />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1 flex-wrap">
            {badges.slice(0, 1).map(b => (
              <span key={b} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${BADGE_CFG[b].cls}`}>
                {BADGE_CFG[b].label}
              </span>
            ))}
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ⭐ Featured
            </span>
          </div>

          {/* Bottom-of-image info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-base text-white leading-tight mb-1.5 line-clamp-2">{evt.name}</h3>
            <div className="flex items-center gap-3 text-xs text-white/65">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(evt.date), "MMM d, yyyy")}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{evt.venue}</span>
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="p-3 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold text-sm ${minPrice === 0 ? "text-emerald-400" : "text-primary"}`}>
              {minPrice === 0 ? "Free" : `${minPrice} ETH`}
            </span>
            <StarRating avg={avg} count={count} />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80">
            <Clock className="h-3 w-3" />
            <CountdownTimer date={evt.date} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Quick Preview Dialog ─────────────────────────────────────────────────────

function PreviewDialog({ evt, open, onClose, ratingStore, userRated, onRate }: {
  evt: LocalEvent | null;
  open: boolean;
  onClose: () => void;
  ratingStore: RatingStore;
  userRated: Set<string>;
  onRate: (id: string, n: number) => void;
}) {
  if (!evt) return null;
  const minPrice    = getMinPrice(evt.ticket_tiers);
  const left        = getTotalLeft(evt.ticket_tiers);
  const fill        = getFill(evt.ticket_tiers);
  const badges      = getBadges(evt);
  const { avg, count } = getAvg(ratingStore, evt.id);
  const alreadyRated = userRated.has(evt.id);
  const grad        = CAT_GRAD[evt.category] ?? CAT_GRAD.general;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden glass border-white/[0.08] rounded-2xl">
        {/* Header image */}
        <div className="relative h-48">
          {evt.image_url ? (
            <img src={evt.image_url} alt={evt.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute bottom-3 left-4 right-10">
            <div className="flex gap-1 flex-wrap mb-1.5">
              {badges.map(b => (
                <span key={b} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_CFG[b].cls}`}>
                  {BADGE_CFG[b].label}
                </span>
              ))}
            </div>
            <DialogTitle className="text-white text-xl font-bold leading-tight">{evt.name}</DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4 text-white/80" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Meta */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              {format(new Date(evt.date), "EEEE, MMMM d, yyyy · h:mm a")}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              {evt.venue}{evt.location ? `, ${evt.location}` : ""}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
              <CountdownTimer date={evt.date} />
            </div>
          </div>

          {/* Description */}
          {evt.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{evt.description}</p>
          )}

          {/* Ticket tiers */}
          {evt.ticket_tiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket Tiers</p>
              {evt.ticket_tiers.map(tier => (
                <div key={tier.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium">{tier.tier_name}</p>
                    <p className="text-[11px] text-muted-foreground">{tier.remaining_supply}/{tier.total_supply} remaining</p>
                  </div>
                  <span className={`font-mono font-bold text-sm ${tier.price === 0 ? "text-emerald-400" : "text-primary"}`}>
                    {tier.price === 0 ? "Free" : `${tier.price} ETH`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Availability bar */}
          {getTotalCapacity(evt.ticket_tiers) > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{fill}% filled · {left} tickets left</span>
                <span className={fill >= 80 ? "text-orange-400 font-semibold" : ""}>
                  {fill >= 80 ? "Selling fast!" : `${100 - fill}% available`}
                </span>
              </div>
              <Progress value={fill} className="h-1.5" />
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-3">
            <StarRating
              avg={avg}
              count={count}
              interactive={!alreadyRated}
              onRate={n => onRate(evt.id, n)}
            />
            <span className="text-[11px] text-muted-foreground">
              {alreadyRated ? "Thanks for rating!" : count === 0 ? "Be the first to rate" : `${count} rating${count !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* CTA */}
          <Link to={`/events/${evt.id}`} onClick={onClose}>
            <Button className="w-full gradient-primary gap-2 mt-1">
              <Ticket className="h-4 w-4" /> Get Tickets
              {minPrice > 0 && <span className="ml-auto font-mono text-xs opacity-80">from {minPrice} ETH</span>}
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Events = () => {
  const navigate = useNavigate();

  const [allEvents, setAllEvents]     = useState<LocalEvent[]>([]);
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("all");
  const [sort, setSort]               = useState<"date" | "price-asc" | "price-desc" | "popular">("date");
  const [page, setPage]               = useState(1);
  const [ratingStore, setRatingStore] = useState<RatingStore>({});
  const [previewEvt, setPreviewEvt]   = useState<LocalEvent | null>(null);
  const [userRated, setUserRated]     = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);

  // Load + subscribe to data
  useEffect(() => {
    const load = () => {
      setAllEvents(localDB.getEvents({ status: "published" }));
      setRatingStore(readRatings());
      setLoading(false);
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("fairpass_rating", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("fairpass_rating", load);
    };
  }, []);

  // Featured: top 3 by fill rate, falling back to nearest by date
  const featuredEvents = useMemo(() => {
    const upcoming = allEvents.filter(e => !isPast(new Date(e.date)));
    const sorted = [...upcoming].sort((a, b) => getFill(b.ticket_tiers) - getFill(a.ticket_tiers));
    return sorted.length ? sorted.slice(0, 3) : upcoming.slice(0, 3);
  }, [allEvents]);

  // Trending strip: events with some fill, sorted by fill desc
  const trendingEvents = useMemo(
    () => [...allEvents]
      .filter(e => getFill(e.ticket_tiers) > 0 && !isPast(new Date(e.date)))
      .sort((a, b) => getFill(b.ticket_tiers) - getFill(a.ticket_tiers))
      .slice(0, 8),
    [allEvents],
  );

  // Filtered + sorted for grid
  const filtered = useMemo(() => {
    let evts = [...allEvents];
    if (search.trim()) {
      const q = search.toLowerCase();
      evts = evts.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        (e.location ?? "").toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q),
      );
    }
    if (category !== "all") evts = evts.filter(e => e.category === category);
    switch (sort) {
      case "price-asc":  evts.sort((a, b) => getMinPrice(a.ticket_tiers) - getMinPrice(b.ticket_tiers)); break;
      case "price-desc": evts.sort((a, b) => getMinPrice(b.ticket_tiers) - getMinPrice(a.ticket_tiers)); break;
      case "popular":    evts.sort((a, b) => getFill(b.ticket_tiers) - getFill(a.ticket_tiers)); break;
      default:           evts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return evts;
  }, [allEvents, search, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEvents = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [search, category, sort]);

  const handleRate = useCallback((id: string, n: number) => {
    if (userRated.has(id)) return;
    submitRating(id, n);
    setUserRated(prev => new Set([...prev, id]));
  }, [userRated]);

  // Pagination page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    const nums = Array.from({ length: totalPages }, (_, i) => i + 1);
    return nums
      .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
      .reduce<(number | "…")[]>((acc, n, idx, arr) => {
        if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
        acc.push(n);
        return acc;
      }, []);
  }, [totalPages, page]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* Back */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Page Header */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">FairPass</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Discover Events</h1>
          <p className="text-muted-foreground">Find your next unforgettable experience — secured by blockchain</p>
        </div>

        {/* ── Featured Section ───────────────────────────────────── */}
        {!loading && featuredEvents.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h2 className="text-base font-semibold">Featured Events</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
              {featuredEvents.map((evt, i) => (
                <div key={evt.id} className="snap-start">
                  <FeaturedCard evt={evt} ratingStore={ratingStore} index={i} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Trending Strip ─────────────────────────────────────── */}
        {!loading && trendingEvents.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-fuchsia-400" />
              <h2 className="text-base font-semibold">Trending Right Now</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {trendingEvents.map(evt => (
                <Link key={evt.id} to={`/events/${evt.id}`}>
                  <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] hover:border-fuchsia-500/40 hover:bg-fuchsia-500/10 transition-all duration-200 cursor-pointer whitespace-nowrap">
                    <Flame className="h-3 w-3 text-fuchsia-400" />
                    <span className="text-xs font-medium">{evt.name}</span>
                    <span className="text-[10px] text-fuchsia-300 font-bold">{getFill(evt.ticket_tiers)}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Category Pills ─────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {CATEGORIES.map(cat => {
            const catCount = cat.value === "all"
              ? allEvents.length
              : allEvents.filter(e => e.category === cat.value).length;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-200
                  ${category === cat.value
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                    : "bg-white/[0.03] text-muted-foreground border-white/[0.07] hover:border-primary/30 hover:text-foreground"
                  }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {catCount > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${category === cat.value ? "bg-white/20 text-white" : "bg-white/[0.07] text-muted-foreground"}`}>
                    {catCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search + Sort ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search events, venues, locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 glass border-white/[0.08] focus:border-primary/40 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="h-10 px-3 rounded-lg border border-white/[0.08] bg-[#0f0a1f] text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors cursor-pointer"
          >
            <option value="date">📅 Soonest First</option>
            <option value="popular">🔥 Most Popular</option>
            <option value="price-asc">💰 Price: Low → High</option>
            <option value="price-desc">💰 Price: High → Low</option>
          </select>
        </div>

        {/* Results summary */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">
              {filtered.length === 0
                ? "No events found"
                : `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`}
              {search && <> for &ldquo;<span className="text-foreground">{search}</span>&rdquo;</>}
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            )}
          </div>
        )}

        {/* ── Events Grid ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl h-[360px] bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : pageEvents.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-6">
              <Ticket className="h-10 w-10 text-muted-foreground/25" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-5">
              Try a different search or category filter.
            </p>
            <Button variant="outline" onClick={() => { setSearch(""); setCategory("all"); }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${page}-${category}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {pageEvents.map(evt => (
                <EventCard
                  key={evt.id}
                  evt={evt}
                  ratingStore={ratingStore}
                  onPreview={setPreviewEvt}
                  userRated={userRated}
                  onRate={handleRate}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Pagination ─────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <div className="flex gap-1">
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-muted-foreground text-sm">…</span>
                ) : (
                  <Button
                    key={n}
                    size="sm"
                    variant={page === n ? "default" : "outline"}
                    onClick={() => setPage(n as number)}
                    className="w-9 h-9 p-0"
                  >
                    {n}
                  </Button>
                ),
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="gap-1.5"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

      </motion.div>

      {/* ── Quick Preview Dialog ──────────────────────────────────── */}
      <PreviewDialog
        evt={previewEvt}
        open={!!previewEvt}
        onClose={() => setPreviewEvt(null)}
        ratingStore={ratingStore}
        userRated={userRated}
        onRate={handleRate}
      />
    </div>
  );
};

export default Events;
