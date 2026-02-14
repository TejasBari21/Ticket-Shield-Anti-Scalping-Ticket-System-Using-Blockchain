import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, User, Ticket, Clock, ArrowLeft, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInSeconds } from "date-fns";
import { BrowserProvider } from "ethers";

interface EventData {
  id: string;
  name: string;
  description: string | null;
  date: string;
  end_date: string | null;
  venue: string;
  location: string | null;
  image_url: string | null;
  category: string | null;
  organizer_id: string;
  resale_enabled: boolean;
  resale_price_cap_percent: number | null;
}

interface TierData {
  id: string;
  tier_name: string;
  price: number;
  total_supply: number;
  remaining_supply: number;
  max_per_wallet: number;
  sales_start: string | null;
  sales_end: string | null;
}

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected, connectWallet, userId } = useWallet();
  const { toast } = useToast();
  const [event, setEvent] = useState<EventData | null>(null);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizer, setOrganizer] = useState<string>("");
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      const { data: eventData } = await supabase.from("events").select("*").eq("id", id).single();
      const { data: tierData } = await supabase.from("ticket_tiers").select("*").eq("event_id", id).order("price");

      if (eventData) {
        setEvent(eventData as any);
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, wallet_address")
          .eq("user_id", (eventData as any).organizer_id)
          .single();
        setOrganizer(profile?.display_name || profile?.wallet_address?.slice(0, 10) || "Unknown");
      }
      setTiers((tierData as any) || []);
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  // Countdown
  useEffect(() => {
    if (!event) return;
    const interval = setInterval(() => {
      const diff = differenceInSeconds(new Date(event.date), new Date());
      if (diff <= 0) {
        setCountdown("Event Started");
      } else {
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setCountdown(`${d}d ${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const handleBuy = async (tier: TierData) => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (!address || !userId) return;

    const qty = quantities[tier.id] || 1;
    setBuying(tier.id);

    try {
      // Simulate MetaMask transaction
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const totalPrice = tier.price * qty;

      // Sign a message to simulate a purchase (no real ETH transfer in demo)
      const message = `BlockTix Purchase\nEvent: ${event?.name}\nTier: ${tier.tier_name}\nQty: ${qty}\nTotal: ${totalPrice} ETH\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      // Create tickets in Supabase
      const tickets = Array.from({ length: qty }, () => ({
        tier_id: tier.id,
        event_id: event!.id,
        owner_wallet: address.toLowerCase(),
        owner_user_id: userId,
        status: "active" as const,
        purchase_tx: signature.slice(0, 66),
        token_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));

      const { error: ticketError } = await supabase.from("tickets").insert(tickets);
      if (ticketError) throw ticketError;

      // Record transaction
      await supabase.from("transactions").insert({
        ticket_id: null,
        from_wallet: null,
        to_wallet: address.toLowerCase(),
        to_user_id: userId,
        price: totalPrice,
        tx_hash: signature.slice(0, 66),
        tx_type: "purchase" as const,
      });

      // Update remaining supply
      await supabase
        .from("ticket_tiers")
        .update({ remaining_supply: tier.remaining_supply - qty })
        .eq("id", tier.id);

      toast({ title: "Purchase Successful! 🎉", description: `${qty} ticket(s) for ${tier.tier_name}` });
      // Refresh tiers
      const { data: updated } = await supabase.from("ticket_tiers").select("*").eq("event_id", id).order("price");
      setTiers((updated as any) || []);
      setQuantities({ ...quantities, [tier.id]: 1 });
    } catch (err: any) {
      toast({ title: "Purchase Failed", description: err.message || "Transaction rejected", variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="glass rounded-2xl h-96 animate-pulse" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-2xl font-bold">Event Not Found</h2>
        <Button onClick={() => navigate("/events")} variant="outline" className="mt-4">Back to Events</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/events")} className="mb-6 gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="h-64 bg-gradient-to-br from-primary/20 to-secondary/20 relative">
                {event.image_url ? (
                  <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ticket className="h-24 w-24 text-primary/20" />
                  </div>
                )}
              </div>
              <div className="p-8">
                <Badge className="mb-4">{event.category || "General"}</Badge>
                <h1 className="text-3xl font-bold mb-4">{event.name}</h1>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">{format(new Date(event.date), "EEEE, MMM d, yyyy")}</p>
                      <p className="text-sm">{format(new Date(event.date), "h:mm a")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">{event.venue}</p>
                      <p className="text-sm">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">Organizer</p>
                      <p className="text-sm font-mono">{organizer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">Countdown</p>
                      <p className="text-sm font-mono text-primary">{countdown}</p>
                    </div>
                  </div>
                </div>

                {event.description && (
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground leading-relaxed">{event.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ticket tiers */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Tickets</h2>
            {tiers.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center text-muted-foreground">No tickets available</div>
            ) : (
              tiers.map((tier) => {
                const qty = quantities[tier.id] || 1;
                const soldOut = tier.remaining_supply <= 0;
                return (
                  <div key={tier.id} className="glass rounded-xl p-5 space-y-4 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{tier.tier_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {tier.remaining_supply}/{tier.total_supply} remaining
                        </p>
                      </div>
                      <span className="text-lg font-mono font-bold text-primary">
                        {tier.price > 0 ? `${tier.price} ETH` : "Free"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">Max {tier.max_per_wallet} per wallet</p>

                    {!soldOut && (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQuantities({ ...quantities, [tier.id]: Math.max(1, qty - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-mono w-8 text-center">{qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQuantities({ ...quantities, [tier.id]: Math.min(tier.max_per_wallet, qty + 1) })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <Button
                      className="w-full gradient-primary hover:opacity-90"
                      disabled={soldOut || buying === tier.id}
                      onClick={() => handleBuy(tier)}
                    >
                      {soldOut ? "Sold Out" : buying === tier.id ? "Confirming..." : `Buy ${qty} for ${(tier.price * qty).toFixed(4)} ETH`}
                    </Button>
                  </div>
                );
              })
            )}

            {event.resale_enabled && (
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Resale enabled · Max {event.resale_price_cap_percent}% of face value
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EventDetail;
