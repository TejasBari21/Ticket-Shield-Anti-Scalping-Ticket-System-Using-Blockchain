import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Ticket, QrCode, Calendar, MapPin, Tag, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInHours } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

interface TicketWithDetails {
  id: string;
  status: string;
  purchase_tx: string | null;
  token_id: string | null;
  qr_secret: string | null;
  created_at: string;
  events: { id: string; name: string; date: string; venue: string; location: string | null };
  ticket_tiers: { tier_name: string; price: number };
}

const statusColors: Record<string, string> = {
  active: "bg-neon-green/20 text-neon-green",
  used: "bg-muted text-muted-foreground",
  listed: "bg-primary/20 text-primary",
  expired: "bg-destructive/20 text-destructive",
};

const MyTickets = () => {
  const { isConnected, userId, address } = useWallet();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [resalePrice, setResalePrice] = useState("");
  const [listingTicket, setListingTicket] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchTickets = async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*, events(id, name, date, venue, location), ticket_tiers(tier_name, price)")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false });
      setTickets((data as any) || []);
      setLoading(false);
    };
    fetchTickets();
  }, [userId]);

  const handleListForResale = async (ticketId: string, facePrice: number) => {
    if (!resalePrice || !address || !userId) return;
    const price = parseFloat(resalePrice);
    if (price > facePrice) {
      toast({ title: "Price too high", description: `Maximum resale price is ${facePrice} ETH`, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("resale_listings").insert({
      ticket_id: ticketId,
      seller_wallet: address.toLowerCase(),
      seller_user_id: userId,
      asking_price: price,
      price_cap: facePrice,
    });

    if (!error) {
      await supabase.from("tickets").update({ status: "listed" as any }).eq("id", ticketId);
      toast({ title: "Listed for resale! 🎉" });
      // Refresh
      const { data } = await supabase
        .from("tickets")
        .select("*, events(id, name, date, venue, location), ticket_tiers(tier_name, price)")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false });
      setTickets((data as any) || []);
    } else {
      toast({ title: "Failed to list", description: error.message, variant: "destructive" });
    }
    setResalePrice("");
    setListingTicket(null);
  };

  const isQRActive = (eventDate: string) => {
    return differenceInHours(new Date(eventDate), new Date()) <= 24;
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20">
        <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-muted-foreground">Connect MetaMask to view your tickets.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">My Tickets</h1>
        <p className="text-muted-foreground mb-8">Your NFT ticket collection</p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-32 animate-pulse" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Tickets Yet</h3>
            <p className="text-muted-foreground">Browse events to purchase your first ticket.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket, i) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-primary/30 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{ticket.events?.name}</h3>
                    <Badge className={statusColors[ticket.status] || ""}>{ticket.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />{ticket.ticket_tiers?.tier_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />{ticket.events && format(new Date(ticket.events.date), "MMM d, yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />{ticket.events?.venue}
                    </span>
                  </div>
                  {ticket.purchase_tx && (
                    <p className="text-xs font-mono text-muted-foreground/60">TX: {ticket.purchase_tx}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* QR Code */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5" disabled={ticket.status !== "active"}>
                        <QrCode className="h-4 w-4" />
                        QR
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-strong">
                      <DialogHeader>
                        <DialogTitle>Ticket QR Code</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center py-6">
                        {ticket.events && isQRActive(ticket.events.date) ? (
                          <>
                            <div className="bg-white p-4 rounded-xl">
                              <QRCodeSVG
                                value={JSON.stringify({ ticketId: ticket.id, secret: ticket.qr_secret })}
                                size={200}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground mt-4">Show this at the venue for check-in</p>
                          </>
                        ) : (
                          <>
                            <QrCode className="h-24 w-24 text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground text-center">
                              QR code activates 24 hours before the event
                            </p>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Resale */}
                  {ticket.status === "active" && (
                    <Dialog open={listingTicket === ticket.id} onOpenChange={(o) => !o && setListingTicket(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setListingTicket(ticket.id)}>
                          <ArrowUpRight className="h-4 w-4" />
                          Resell
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-strong">
                        <DialogHeader>
                          <DialogTitle>List for Resale</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <p className="text-sm text-muted-foreground">
                            Max price: {ticket.ticket_tiers?.price} ETH (face value)
                          </p>
                          <Input
                            type="number"
                            placeholder="Price in ETH"
                            value={resalePrice}
                            onChange={(e) => setResalePrice(e.target.value)}
                            step="0.0001"
                            max={ticket.ticket_tiers?.price}
                          />
                          <Button
                            className="w-full gradient-primary"
                            onClick={() => handleListForResale(ticket.id, ticket.ticket_tiers?.price || 0)}
                          >
                            List for Resale
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MyTickets;
