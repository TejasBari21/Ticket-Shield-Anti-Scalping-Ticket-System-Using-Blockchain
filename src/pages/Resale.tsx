import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Ticket, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { BrowserProvider } from "ethers";

interface ResaleListing {
  id: string;
  asking_price: number;
  price_cap: number | null;
  created_at: string;
  seller_wallet: string;
  ticket_id: string;
  tickets: {
    id: string;
    event_id: string;
    tier_id: string;
    events: { name: string; date: string; venue: string };
    ticket_tiers: { tier_name: string; price: number };
  };
}

const Resale = () => {
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const { isConnected, address, userId, connectWallet } = useWallet();
  const { toast } = useToast();

  const fetchListings = async () => {
    const { data } = await supabase
      .from("resale_listings")
      .select("*, tickets(id, event_id, tier_id, events(name, date, venue), ticket_tiers(tier_name, price))")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setListings((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchListings(); }, []);

  const handleBuyResale = async (listing: ResaleListing) => {
    if (!isConnected) { connectWallet(); return; }
    if (!address || !userId) return;

    setBuying(listing.id);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const message = `BlockTix Resale Purchase\nTicket: ${listing.ticket_id}\nPrice: ${listing.asking_price} ETH\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      // Transfer ticket ownership
      await supabase.from("tickets").update({
        owner_wallet: address.toLowerCase(),
        owner_user_id: userId,
        status: "active" as any,
      }).eq("id", listing.ticket_id);

      // Mark listing as sold
      await supabase.from("resale_listings").update({ status: "sold" as any }).eq("id", listing.id);

      // Record transaction
      await supabase.from("transactions").insert({
        ticket_id: listing.ticket_id,
        from_wallet: listing.seller_wallet,
        to_wallet: address.toLowerCase(),
        to_user_id: userId,
        price: listing.asking_price,
        tx_hash: signature.slice(0, 66),
        tx_type: "resale" as const,
      });

      toast({ title: "Resale Purchase Complete! 🎉" });
      fetchListings();
    } catch (err: any) {
      toast({ title: "Purchase Failed", description: err.message, variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2">Resale Marketplace</h1>
        <p className="text-muted-foreground mb-8">Buy tickets at fair, capped prices</p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-24 animate-pulse" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Resale Listings</h3>
            <p className="text-muted-foreground">Check back later for available resale tickets.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-primary/30 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{listing.tickets?.events?.name}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5" />{listing.tickets?.ticket_tiers?.tier_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />{listing.tickets?.events?.venue}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Seller: {listing.seller_wallet.slice(0, 6)}...{listing.seller_wallet.slice(-4)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-mono font-bold text-primary">{listing.asking_price} ETH</p>
                    <p className="text-xs text-muted-foreground">
                      Face: {listing.tickets?.ticket_tiers?.price} ETH
                    </p>
                  </div>
                  <Button
                    className="gradient-primary hover:opacity-90"
                    disabled={buying === listing.id || listing.seller_wallet === address?.toLowerCase()}
                    onClick={() => handleBuyResale(listing)}
                  >
                    {buying === listing.id ? "Confirming..." : "Buy"}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Resale;
