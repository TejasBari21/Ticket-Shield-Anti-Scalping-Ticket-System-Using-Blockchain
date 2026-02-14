import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Calendar, MapPin, Filter, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface Event {
  id: string;
  name: string;
  description: string | null;
  date: string;
  venue: string;
  location: string | null;
  image_url: string | null;
  category: string | null;
  status: string;
  ticket_tiers?: { price: number; remaining_supply: number }[];
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      let query = supabase
        .from("events")
        .select("*, ticket_tiers(price, remaining_supply)")
        .eq("status", "published")
        .order("date", { ascending: true });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }
      if (category !== "all") {
        query = query.eq("category", category);
      }

      const { data } = await query;
      setEvents((data as any) || []);
      setLoading(false);
    };
    fetchEvents();
  }, [search, category]);

  const getMinPrice = (tiers: { price: number }[]) => {
    if (!tiers?.length) return 0;
    return Math.min(...tiers.map((t) => t.price));
  };

  const getTotalRemaining = (tiers: { remaining_supply: number }[]) => {
    if (!tiers?.length) return 0;
    return tiers.reduce((sum, t) => sum + t.remaining_supply, 0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">Discover Events</h1>
        <p className="text-muted-foreground mb-8">Find your next experience</p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 glass border-border/50"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px] glass border-border/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="music">Music</SelectItem>
              <SelectItem value="sports">Sports</SelectItem>
              <SelectItem value="tech">Tech</SelectItem>
              <SelectItem value="art">Art</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Events grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
            <p className="text-muted-foreground">Check back later for upcoming events.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/events/${event.id}`}>
                  <div className="glass rounded-2xl overflow-hidden group hover:border-primary/30 transition-all hover:neon-glow cursor-pointer">
                    <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden">
                      {event.image_url ? (
                        <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Ticket className="h-16 w-16 text-primary/20" />
                        </div>
                      )}
                      <Badge className="absolute top-3 right-3 bg-primary/80 backdrop-blur-sm">
                        {event.category || "General"}
                      </Badge>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                        {event.name}
                      </h3>
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(event.date), "MMM d, yyyy · h:mm a")}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.venue}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                        <span className="font-mono font-semibold text-primary">
                          {getMinPrice(event.ticket_tiers || []) > 0
                            ? `From ${getMinPrice(event.ticket_tiers || [])} ETH`
                            : "Free"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getTotalRemaining(event.ticket_tiers || [])} left
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Events;
