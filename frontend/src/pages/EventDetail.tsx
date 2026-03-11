import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, User, Ticket, Clock, ArrowLeft, Minus, Plus, ShieldAlert, Wallet, AlertTriangle } from "lucide-react";
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInSeconds } from "date-fns";
import { useKYC } from "@/hooks/useKYC";
import AntiBotChallenge from "@/components/AntiBotChallenge";
import { useAntiBot } from "@/hooks/useAntiBot";
import { localDB, ticketDB, auditLogDB } from "@/lib/localDB";
import { generateTicketPDF } from "@/lib/generateTicketPDF";
import MintingFlow, { MintResult } from "@/components/MintingFlow";
import { mintTicket, initializeContract } from "@/integrations/contracts/contractService";

const CONTRACT_ADDRESS = (import.meta as any).env.VITE_CONTRACT_ADDRESS as string;

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
  status?: string;
  kyc_required?: boolean;
  contract_event_id?: number;
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
  const { address, isConnected, connectWallet, userId, hasRole } = useWallet();
  const { toast } = useToast();
  const { kycStatus } = useKYC();
  const [event, setEvent] = useState<EventData | null>(null);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizer, setOrganizer] = useState<string>("");
  const [countdown, setCountdown] = useState("");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<TierData | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintStep, setMintStep] = useState<0 | 1 | 2 | 3>(0);
  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { checkRateLimit, logAttempt, isDwellTimeSufficient } = useAntiBot();

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const ev = localDB.getEvent(id);
    if (ev) {
      setEvent(ev as unknown as EventData);
      setTiers(ev.ticket_tiers as unknown as TierData[]);
      const initQty: Record<string, number> = {};
      ev.ticket_tiers.forEach((t) => { initQty[t.id] = 1; });
      setQuantities(initQty);
    }
    setLoading(false);
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

  /**
   * Step 1 — pre-validate then open the anti-bot challenge dialog.
   * The actual purchase only runs after the challenge is solved.
   */
  const handleBuy = async (tier: TierData) => {
    // Admins cannot purchase tickets
    if (hasRole("admin")) {
      toast({
        title: "Admin Account",
        description: "Admin accounts cannot purchase tickets. Use a regular user account.",
        variant: "destructive",
      });
      return;
    }

    // Must be logged in with email first
    if (!userId) {
      navigate("/login");
      return;
    }

    // MetaMask must be connected for blockchain purchase
    if (!isConnected) {
      toast({
        title: "Connect MetaMask",
        description: "Please connect your MetaMask wallet to complete the purchase.",
      });
      connectWallet();
      return;
    }

    if (!address) return;

    const qty = quantities[tier.id] || 1;

    // Dwell-time guard: reject if user landed on this page < 2 seconds ago
    if (!isDwellTimeSufficient()) {
      toast({
        title: "Please slow down",
        description: "Please wait a moment before purchasing a ticket.",
        variant: "destructive",
      });
      return;
    }

    // KYC gate
    if (event?.kyc_required && kycStatus !== "approved") {
      toast({
        title: "Identity Verification Required",
        description: "This event requires KYC verification. Please complete identity verification first.",
        variant: "destructive",
      });
      navigate("/kyc");
      return;
    }

    // Block purchases if event is not published
    if (event?.status && event.status !== "published") {
      toast({ title: "Event Not Available", description: "This event is not open for sales.", variant: "destructive" });
      return;
    }

    // Block purchases if sales window has closed
    if (event?.end_date) {
      const salesEnd = new Date(event.end_date).getTime();
      if (Date.now() >= salesEnd) {
        toast({ title: "Sales Closed", description: "Ticket sales for this event have closed.", variant: "destructive" });
        return;
      }
    }

    // All pre-checks passed — show confirmation dialog before proceeding
    setPendingTier(tier);
    setConfirmOpen(true);
  };

  /**
   * Step 2 — called after the user solves the CAPTCHA.
   * Performs rate-limit check then executes the actual purchase.
   */
  const proceedWithPurchase = async (tier: TierData) => {
    if (!address || !userId) return;

    const qty = quantities[tier.id] || 1;

    // Anti-bot rate-limit / cooldown check
    let antiBotResult;
    try {
      antiBotResult = await checkRateLimit(address, userId, event?.id, tier.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Anti-bot check failed";
      toast({ title: "Verification Error", description: msg, variant: "destructive" });
      return;
    }

    if (!antiBotResult.allowed) {
      toast({ title: "Purchase Blocked", description: antiBotResult.reason, variant: "destructive" });
      return;
    }

    setBuying(tier.id);
    setMintStep(1); // Show step 1 overlay before MetaMask popup
    try {
      // Initialize contract with the user's own wallet address as the signer so that
      // ETH is deducted from the user's wallet, not from whichever account MetaMask
      // currently has selected (which could be the admin account).
      await initializeContract(CONTRACT_ADDRESS, address);

      const totalPrice = tier.price * qty;
      const contractEventId = event.contract_event_id;

      if (contractEventId === undefined || contractEventId === null) {
        throw new Error("This event is not yet registered on the blockchain. Please ask the admin to re-create it with an admin wallet connected.");
      }

      // Advance to minting animation while MetaMask confirms
      setMintStep(2);

      // Mint qty tickets — each is a real on-chain transaction with ETH transfer
      const mintedTokenIds: number[] = [];
      let lastTxHash = "";
      let lastBlockNumber = 0;

      for (let i = 0; i < qty; i++) {
        const { txHash, tokenId } = await mintTicket(contractEventId, address, tier.price.toString());
        mintedTokenIds.push(tokenId);
        lastTxHash = txHash;
      }

      // Get block info for display
      try {
        const { BrowserProvider } = await import("ethers");
        const provider = new BrowserProvider((window as any).ethereum);
        const block = await provider.getBlockNumber();
        lastBlockNumber = block;
      } catch { lastBlockNumber = 0; }

      // Save purchased tickets to localStorage
      const now = new Date().toISOString();
      const newTickets = mintedTokenIds.map((tokenId, i) => {
        const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const qrSecret = crypto.randomUUID();
        return {
          id: ticketId,
          event_id: event!.id,
          tier_id: tier.id,
          owner_wallet: address.toLowerCase(),
          owner_user_id: userId,
          status: "active" as const,
          purchase_tx: lastTxHash,
          token_id: tokenId.toString(),
          qr_secret: qrSecret,
          created_at: now,
          events: { id: event!.id, name: event!.name, date: event!.date, venue: event!.venue, location: event!.location ?? null },
          ticket_tiers: { tier_name: tier.tier_name, price: tier.price },
        };
      });
      ticketDB.saveTickets(newTickets);

      // Decrement remaining supply and refresh tier state
      localDB.decrementTierSupply(event!.id, tier.id, qty);
      const refreshed = localDB.getEvent(event!.id);
      if (refreshed) setTiers(refreshed.ticket_tiers as unknown as TierData[]);

      // Log successful attempt for audit trail
      await logAttempt(address, userId, "success", event?.id, tier.id);

      // Audit log entry for admin panel
      for (const t of newTickets) {
        auditLogDB.log({
          action: "ticket_purchased",
          wallet: address.toLowerCase(),
          user_id: userId,
          event_id: event!.id,
          event_name: event!.name,
          tx_hash: t.purchase_tx,
          detail: `${tier.tier_name} · ${tier.price} ETH`,
        });
      }

      // The animation already started at setMintStep(2); wait only remaining time if needed
      await new Promise(r => setTimeout(r, 1500));

      // Build mint result and show step 3
      setMintResult({
        eventName: event!.name,
        eventDate: event!.date,
        venue: event!.venue,
        tierName: tier.tier_name,
        tierPrice: tier.price,
        qty,
        blockNumber: lastBlockNumber,
        tickets: newTickets.map((t) => ({
          id: t.id,
          tokenId: t.token_id,
          purchaseTx: t.purchase_tx,
          qrSecret: t.qr_secret,
        })),
      });
      setMintStep(3);
      setQuantities({ ...quantities, [tier.id]: 1 });
    } catch (err) {
      setMintStep(0); // Hide overlay on failure
      await logAttempt(address, userId, "blocked", event?.id, tier.id);
      const msg = err instanceof Error ? err.message : "Transaction rejected";
      toast({ title: "Purchase Failed", description: msg, variant: "destructive" });
    } finally {
      setBuying(null);
      setPendingTier(null);
    }
  };

  /** PDF download callback — passed to MintingFlow */
  const handleDownloadPDF = async () => {
    if (!mintResult || !address) return;
    for (const t of mintResult.tickets) {
      await generateTicketPDF({
        ticketId: t.id,
        qrSecret: t.qrSecret,
        eventName: mintResult.eventName,
        eventDate: mintResult.eventDate,
        venue: mintResult.venue,
        tierName: mintResult.tierName,
        price: mintResult.tierPrice,
        purchaseTx: t.purchaseTx,
        tokenId: t.tokenId,
        ownerWallet: address.toLowerCase(),
        purchasedAt: new Date().toISOString(),
        eventCode: t.id.slice(4, 12).toUpperCase(),
      });
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
            {event?.kyc_required && kycStatus !== "approved" && (
              <div className="glass rounded-xl p-4 border border-amber-500/30 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">KYC Verification Required</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This event requires identity verification before purchasing tickets.
                    {kycStatus === "pending" ? " Your submission is under review." : ""}
                  </p>
                  {kycStatus !== "pending" && (
                    <button onClick={() => navigate("/kyc")} className="text-xs text-primary underline mt-1">
                      Complete Verification →
                    </button>
                  )}
                </div>
              </div>
            )}
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

      {/* 3-step Web3 minting overlay */}
      <MintingFlow
        step={mintStep}
        mintResult={mintResult}
        ownerAddress={address}
        onDownloadPDF={handleDownloadPDF}
        onGoToTickets={() => navigate("/my-tickets")}
      />

      {/* Purchase confirmation dialog */}
      {pendingTier && (
        <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) { setConfirmOpen(false); setPendingTier(null); } }}>
          <DialogContent className="glass-strong max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Confirm Purchase
              </DialogTitle>
              <DialogDescription>Review the transaction details below before proceeding.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm mt-1">
              <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Action</span>
                  <span className="font-semibold text-primary">Ticket Purchase</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium truncate max-w-[160px]">{event?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-medium">{pendingTier.tier_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-medium">{quantities[pendingTier.id] || 1}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/[0.06] pt-2">
                  <span className="text-muted-foreground font-medium">Total ETH</span>
                  <span className="font-bold text-lg text-primary font-mono">
                    {(pendingTier.price * (quantities[pendingTier.id] || 1)).toFixed(4)} ETH
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3 flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Paying from wallet</p>
                  <p className="font-mono text-xs truncate">{address}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                ETH will be sent from your wallet to the smart contract. The organizer receives 95%, platform retains 5%.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setConfirmOpen(false); setPendingTier(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gradient-primary"
                onClick={() => {
                  setConfirmOpen(false);
                  setChallengeOpen(true);
                }}
              >
                Confirm & Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Anti-bot CAPTCHA challenge — shown before every purchase */}
      <AntiBotChallenge
        open={challengeOpen}
        onVerified={() => {
          setChallengeOpen(false);
          if (pendingTier) proceedWithPurchase(pendingTier);
        }}
        onCancel={() => {
          setChallengeOpen(false);
          setPendingTier(null);
        }}
      />
    </div>
  );
};

export default EventDetail;
