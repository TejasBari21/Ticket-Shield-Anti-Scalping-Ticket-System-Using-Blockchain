import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Ticket, Calendar } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { buyFromResale, initializeContract } from "@/integrations/contracts/contractService";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import AntiBotChallenge from "@/components/AntiBotChallenge";
import { useAntiBot } from "@/hooks/useAntiBot";
import { useNavigate } from "react-router-dom";

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
    token_id?: string | null;
    events: { name: string; date: string; venue: string; end_date?: string | null; status?: string };
    ticket_tiers: { tier_name: string; price: number };
  };
}

const Resale = () => {
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [pendingListing, setPendingListing] = useState<ResaleListing | null>(null);
  const { isConnected, address, userId, connectWallet } = useWallet();
  const { toast } = useToast();
  const { checkRateLimit, logAttempt, isDwellTimeSufficient } = useAntiBot();
  const navigate = useNavigate();

  const fetchListings = () => {
    // No database — resale marketplace shows empty state
    setListings([]);
    setLoading(false);
  };

  useEffect(() => { fetchListings(); }, []);

  const handleBuyResale = async (listing: ResaleListing) => {
    if (!userId) { navigate("/login"); return; }
    if (!isConnected) {
      toast({ title: "Connect MetaMask", description: "Please connect your MetaMask wallet.", });
      connectWallet();
      return;
    }
    if (!address) return;
    if (!isDwellTimeSufficient()) {
      toast({ title: "Please slow down", description: "Please wait a moment before purchasing.", variant: "destructive" });
      return;
    }
    const evt = listing.tickets?.events;
    if (evt?.status && evt.status !== "published") {
      toast({ title: "Event Closed", variant: "destructive" });
      return;
    }
    setPendingListing(listing);
    setChallengeOpen(true);
  };

  const proceedBuyResale = async (listing: ResaleListing) => {
    if (!address || !userId) return;
    let antiBotResult;
    try {
      antiBotResult = await checkRateLimit(address, userId, listing.tickets?.event_id);
    } catch (err: unknown) {
      toast({ title: "Verification Error", description: (err as Error).message, variant: "destructive" });
      return;
    }
    if (!antiBotResult.allowed) {
      toast({ title: "Purchase Blocked", description: antiBotResult.reason, variant: "destructive" });
      return;
    }
    setBuying(listing.id);
    try {
      const onChainTokenId = listing.tickets?.token_id;
      if (onChainTokenId && /^\d+$/.test(onChainTokenId)) {
        const contractAddress = (import.meta.env as Record<string, string>).VITE_CONTRACT_ADDRESS;
        // Pass buyer's address so resale purchase is signed by the user, not the admin
        await initializeContract(contractAddress, address);
        await buyFromResale(Number(onChainTokenId), listing.asking_price.toString());
      }
      await logAttempt(address, userId, "success", listing.tickets?.event_id);
      toast({ title: "Resale Purchase Complete! 🎉" });
      fetchListings();
    } catch (err: unknown) {
      await logAttempt(address, userId, "blocked", listing.tickets?.event_id);
      toast({ title: "Purchase Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBuying(null);
      setPendingListing(null);
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

      {/* Anti-bot CAPTCHA challenge — shown before every resale purchase */}
      <AntiBotChallenge
        open={challengeOpen}
        onVerified={() => {
          setChallengeOpen(false);
          if (pendingListing) proceedBuyResale(pendingListing);
        }}
        onCancel={() => {
          setChallengeOpen(false);
          setPendingListing(null);
        }}
      />
    </div>
  );
};

export default Resale;
