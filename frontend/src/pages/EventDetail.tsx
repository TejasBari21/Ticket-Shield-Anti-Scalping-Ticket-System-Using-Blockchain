import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, User, Ticket, Clock, ArrowLeft, Minus, Plus, ShieldAlert, Wallet, AlertTriangle, CheckCircle } from "lucide-react";
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInSeconds } from "date-fns";
import AntiBotChallenge from "@/components/AntiBotChallenge";
import { useAntiBot } from "@/hooks/useAntiBot";
import { localDB, ticketDB, auditLogDB } from "@/lib/localDB";
import { generateTicketPDF } from "@/lib/generateTicketPDF";
import MintingFlow, { MintResult } from "@/components/MintingFlow";
import { mintTicket, initializeContract } from "@/integrations/contracts/contractService";
import { insertTicketsToSupabase } from "@/integrations/supabase/ticketSync";
import { getTicketPDFData } from "@/integrations/supabase/ticketWithEvent";
// Email API will be called directly in booking flow

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
  const { appUser } = useAuth();
  const { toast } = useToast();
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
    if (hasRole("admin")) {
      toast({ title: "Admin Account", description: "Admin accounts cannot purchase tickets. Use a regular user account.", variant: "destructive" });
      return;
    }
    if (!userId) { navigate("/login"); return; }
    if (!isConnected) { toast({ title: "Connect MetaMask", description: "Please connect your MetaMask wallet to complete the purchase." }); connectWallet(); return; }
    if (!address) return;
    if (!isDwellTimeSufficient()) { toast({ title: "Please slow down", description: "Please wait a moment before purchasing a ticket.", variant: "destructive" }); return; }
    if (event?.status && event.status !== "published") { toast({ title: "Event Not Available", description: "This event is not open for sales.", variant: "destructive" }); return; }
    if (event?.end_date) {
      const salesEnd = new Date(event.end_date).getTime();
      if (Date.now() >= salesEnd) { toast({ title: "Sales Closed", description: "Ticket sales for this event have closed.", variant: "destructive" }); return; }
    }
    setPendingTier(tier);
    setConfirmOpen(true);
  };

  const proceedWithPurchase = async (tier: TierData) => {
    if (!address || !userId) return;
    const qty = quantities[tier.id] || 1;
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
    setMintStep(1);
    try {
      await initializeContract(CONTRACT_ADDRESS, address);
      const contractEventId = event.contract_event_id;
      if (contractEventId === undefined || contractEventId === null) {
        throw new Error("This event is not registered on the blockchain.");
      }
      setMintStep(2);
      const mintedTokenIds: number[] = [];
      let lastTxHash = "";
      let lastBlockNumber = 0;
      for (let i = 0; i < qty; i++) {
        const { txHash, tokenId } = await mintTicket(contractEventId, address, tier.price.toString());
        mintedTokenIds.push(tokenId);
        lastTxHash = txHash;
      }
      try {
        const { BrowserProvider } = await import("ethers");
        const provider = new BrowserProvider((window as any).ethereum);
        const block = await provider.getBlockNumber();
        lastBlockNumber = block;
      } catch { lastBlockNumber = 0; }
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
          events: { id: event!.id, name: event!.name, date: event!.date, venue: event!.venue, location: event!.location ?? null, image_url: event!.image_url ?? null },
          ticket_tiers: { tier_name: tier.tier_name, price: tier.price },
        };
      });

      // Sync tickets to Supabase (primary storage) with retry logic
      setMintStep(2); // Still on sync step
      let supabaseSyncSucceeded = false;
      let syncAttempts = 0;
      const maxSyncAttempts = 3;

      while (!supabaseSyncSucceeded && syncAttempts < maxSyncAttempts) {
        try {
          syncAttempts++;
          await insertTicketsToSupabase(newTickets, appUser?.email, (message) => {
            console.log("[Minting] " + message);
          });
          supabaseSyncSucceeded = true;
          console.log("[Minting] Tickets successfully synced to Supabase");
        } catch (syncError) {
          const errorMsg = syncError instanceof Error ? syncError.message : "Unknown error";
          console.error(`[Minting] Supabase sync attempt ${syncAttempts} failed:`, errorMsg);

          if (syncAttempts < maxSyncAttempts) {
            // Wait a moment before next retry
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      // If Supabase sync failed, show warning but continue with local save
      if (!supabaseSyncSucceeded) {
        console.warn("[Minting] Failed to sync to Supabase, falling back to local storage");
        toast({
          title: "Cloud Sync Failed",
          description: "Your ticket is saved locally. It will sync to the cloud when the connection is restored.",
          variant: "destructive",
        });
      }

      // Save to localStorage (cache) regardless of Supabase success
      ticketDB.saveTickets(newTickets);
      localDB.decrementTierSupply(event!.id, tier.id, qty);
      const refreshed = localDB.getEvent(event!.id);
      if (refreshed) setTiers(refreshed.ticket_tiers as unknown as TierData[]);
      await logAttempt(address, userId, "success", event?.id, tier.id);
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
      await new Promise(r => setTimeout(r, 1500));
      setMintResult({
        eventName: event!.name,
        eventDate: event!.date,
        venue: event!.venue,
        tierName: tier.tier_name,
        tierPrice: tier.price,
        qty,
        blockNumber: lastBlockNumber,
        eventImageUrl: event!.image_url,
        tickets: newTickets.map((t) => ({ id: t.id, tokenId: t.token_id, purchaseTx: t.purchase_tx, qrSecret: t.qr_secret, })),
      });
      setMintStep(3);
      setQuantities({ ...quantities, [tier.id]: 1 });
    } catch (err) {
      setMintStep(0);
      await logAttempt(address, userId, "blocked", event?.id, tier.id);
      const msg = err instanceof Error ? err.message : "Transaction rejected";
      toast({ title: "Purchase Failed", description: msg, variant: "destructive" });
    } finally {
      setBuying(null);
      setPendingTier(null);
    }
  };

  const handleDownloadPDF = async () => {
    if (!mintResult || !address || !event) {
      toast({
        title: "Error",
        description: "Missing ticket data for PDF generation",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("========================================");
      console.log("[BOOKING] DOWNLOAD PDF + SEND EMAIL FLOW START");
      console.log("========================================");
      
      toast({
        title: "Generating PDF",
        description: "Creating your ticket...",
      });

      let pdfSuccess = false;
      let emailSuccess = false;

      // Generate PDF for each ticket
      for (const ticket of mintResult.tickets) {
        console.log(`\n[BOOKING] Processing ticket: ${ticket.id}`);

        // Try to fetch fresh data from Supabase first
        let pdfData = await getTicketPDFData(ticket.id).catch(err => {
          console.warn(`[BOOKING] Supabase fetch failed, using fallback:`, err.message);
          return null;
        });

        // If Supabase fetch failed, use local data as fallback
        if (!pdfData) {
          console.log(`[BOOKING] Using fallback data from local state`);
          
          pdfData = {
            ticketId: ticket.id,
            qrSecret: ticket.qrSecret,
            eventName: event.name || mintResult.eventName,
            eventDate: event.date ? format(new Date(event.date), "dd MMM yyyy, hh:mm a") : mintResult.eventDate,
            venue: event.venue || "Venue TBA",
            tierName: mintResult.tierName,
            price: mintResult.tierPrice,
            purchaseTx: ticket.purchaseTx,
            tokenId: ticket.tokenId,
            ownerWallet: address.toLowerCase(),
            purchasedAt: format(new Date(), "dd MMM yyyy, hh:mm a"),
            eventCode: event.id,
            imageUrl: event.image_url ?? null,
            eventLocation: event.location || undefined,
          };
        }

        // Generate PDF
        console.log(`[BOOKING] 📄 Generating PDF...`);
        try {
          await generateTicketPDF(pdfData);
          console.log(`[BOOKING] ✅ PDF generated successfully`);
          pdfSuccess = true;
        } catch (pdfErr) {
          console.error(`[BOOKING] ❌ PDF generation failed:`, pdfErr);
          toast({
            title: "PDF Error",
            description: "Could not generate PDF. Try again.",
            variant: "destructive",
          });
          return;
        }

        // Send email immediately after PDF
        if (appUser?.email) {
          console.log(`[BOOKING] 📧 Sending email to ${appUser.email}...`);
          
          try {
            const emailPayload = {
              email: appUser.email.toLowerCase().trim(),
              userFirstName: appUser.email.split("@")[0] || "Guest",
              eventName: event.name,
              eventDate: format(new Date(event.date), "dd MMM yyyy"),
              eventTime: format(new Date(event.date), "hh:mm a"),
              venue: event.venue,
              ticketId: ticket.id,
            };

            console.log("[BOOKING] Email payload:", JSON.stringify(emailPayload, null, 2));

            const response = await fetch("/api/send-ticket-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(emailPayload),
            });

            const emailData = await response.json();

            console.log("[BOOKING] Email API response:", emailData);

            if (!response.ok || !emailData.success) {
              const errorMsg = emailData.error || `HTTP ${response.status}`;
              console.error(`[BOOKING] ❌ EMAIL FAILED: ${errorMsg}`);
              
              // Show actual error to user
              toast({
                title: "Email Failed",
                description: `Could not send email: ${errorMsg}. Your ticket is ready - you can check your wallet.`,
                variant: "destructive",
              });
              emailSuccess = false;
            } else {
              console.log(`[BOOKING] ✅ EMAIL SENT SUCCESSFULLY`);
              console.log(`[BOOKING] Message ID:`, emailData.messageId);
              console.log(`[BOOKING] Provider:`, emailData.provider);
              emailSuccess = true;
            }
          } catch (emailErr) {
            const errorMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            console.error(`[BOOKING] ❌ EMAIL REQUEST FAILED:`, errorMsg);
            
            toast({
              title: "Email Sending Failed",
              description: `Error: ${errorMsg}. PDF is ready - check your wallet.`,
              variant: "destructive",
            });
            emailSuccess = false;
          }
        }
      }

      // Final status notification - ONLY show success if email actually succeeded
      console.log(`\n========================================`);
      console.log(`[BOOKING] FINAL STATUS`);
      console.log(`[BOOKING] PDF Success: ${pdfSuccess}`);
      console.log(`[BOOKING] Email Success: ${emailSuccess}`);
      console.log(`========================================\n`);

      if (pdfSuccess && emailSuccess) {
        toast({
          title: "Complete!",
          description: "PDF ready and confirmation email sent to your inbox",
        });
      } else if (pdfSuccess && !emailSuccess) {
        toast({
          title: "PDF Ready",
          description: "Your ticket PDF is ready. Email delivery failed - check your wallet.",
          variant: "warning",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to complete the booking process",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[BOOKING] CRITICAL ERROR:", err);
      toast({
        title: "Operation Failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto min-h-screen bg-background text-foreground">
        <div className="bg-card border border-border rounded-2xl h-96 animate-pulse shadow-sm" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center py-20 bg-background min-h-screen">
        <h2 className="text-2xl font-bold text-foreground">Event Not Found</h2>
        <Button onClick={() => navigate("/events")} variant="outline" className="mt-4 border-border text-muted-foreground">Back to Events</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto bg-background min-h-screen font-body text-foreground">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/events")} className="mb-6 gap-2 text-muted-foreground hover:text-primary transition-colors font-bold">
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="h-72 bg-muted relative">
                {event.image_url ? (
                  <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ticket className="h-24 w-24 text-primary/10" />
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary text-white py-1 px-3 shadow-sm border-none font-bold uppercase tracking-wider text-[10px]">{event.category || "General"}</Badge>
                </div>
              </div>
              <div className="p-8">
                <h1 className="text-4xl font-bold mb-6 text-foreground tracking-tight">{event.name}</h1>

                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-[#F5F7F8] border border-border">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                       <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Date & Time</p>
                      <p className="text-foreground font-bold text-sm tracking-tight">{format(new Date(event.date), "EEEE, MMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground font-medium">{format(new Date(event.date), "h:mm a")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-[#F5F7F8] border border-border">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                       <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Venue Location</p>
                      <p className="text-foreground font-bold text-sm tracking-tight">{event.venue}</p>
                      <p className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-[#F5F7F8] border border-border">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                       <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Organizer</p>
                      <p className="text-foreground font-bold text-sm tracking-tight">Verified Organizer</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">{event.organizer_id.slice(0, 10)}...</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-sm shadow-primary/5">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                       <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Countdown</p>
                      <p className="text-primary font-bold text-sm font-mono tracking-tight">{countdown}</p>
                      <p className="text-xs text-muted-foreground font-medium">Until Event Launch</p>
                    </div>
                  </div>
                </div>

                {event.description && (
                  <div className="border-t border-border pt-6">
                    <h3 className="font-bold text-lg text-foreground mb-3">About the Event</h3>
                    <p className="text-muted-foreground leading-relaxed font-medium">{event.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ticket tiers */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Acquire Tickets</h2>
            {event?.kyc_required && (
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 flex items-start gap-4 shadow-sm">
                <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700">Identity Verification Event</p>
                  <p className="text-xs text-amber-700/70 mt-1 font-medium leading-relaxed">
                    This event is marked as identity-verified by the organizer.
                  </p>
                </div>
              </div>
            )}
            {tiers.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground font-bold shadow-sm">No tickets available</div>
            ) : (
              tiers.map((tier) => {
                const qty = quantities[tier.id] || 1;
                const soldOut = tier.remaining_supply <= 0;
                return (
                  <div key={tier.id} className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm hover:shadow-lg hover:border-primary/40 transition-all border-l-4 border-l-primary/60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-foreground text-lg tracking-tight">{tier.tier_name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          <p className="text-xs font-bold text-emerald-600">
                            {tier.remaining_supply} available / {tier.total_supply}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-primary block">
                          {tier.price > 0 ? `${tier.price} ETH` : "Free"}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Per Ticket</span>
                      </div>
                    </div>

                    <div className="bg-muted rounded-xl p-3.5 flex items-center justify-between border border-border/60">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Quantity</p>
                       {!soldOut && (
                        <div className="flex items-center gap-4">
                          <button
                            className="h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                            onClick={() => setQuantities({ ...quantities, [tier.id]: Math.max(1, qty - 1) })}
                          >
                            <Minus className="h-3.5 w-3.5 text-primary" />
                          </button>
                          <span className="font-bold text-foreground w-4 text-center">{qty}</span>
                          <button
                            className="h-8 w-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                            onClick={() => setQuantities({ ...quantities, [tier.id]: Math.min(tier.max_per_wallet, qty + 1) })}
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                          </button>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full h-14 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest"
                      disabled={soldOut || buying === tier.id}
                      onClick={() => handleBuy(tier)}
                    >
                      {soldOut ? "Sold Out" : buying === tier.id ? "Confirming..." : `Purchase ${(tier.price * qty).toFixed(3)} ETH`}
                    </Button>
                  </div>
                );
              })
            )}

            {event.resale_enabled && (
              <div className="bg-muted border border-border rounded-xl p-4 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                  Resale Protocol Activated
                </p>
                <p className="text-xs text-primary font-bold mt-1 uppercase tracking-widest">
                   Max {event.resale_price_cap_percent}% Price Protection
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
          <DialogContent className="bg-white border-border max-w-[500px] rounded-[2rem] shadow-2xl p-10 flex flex-col justify-center text-foreground">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-3 text-foreground font-bold text-2xl tracking-tight">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
                Auth Purchase
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium pt-3 text-base">
                Review transaction details before broadcasting to network.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#F5F7F8] border border-border p-6 space-y-4">
                {/* Header row */}
                <div className="grid grid-cols-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] pb-3 border-b border-border">
                   <span>Property</span>
                   <span className="text-right">Value</span>
                </div>
                
                {/* Grid-based property rows */}
                <div className="grid grid-cols-2 gap-y-4 items-center">
                  <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Event</span>
                  <span className="font-bold text-foreground text-right truncate text-sm">{event?.name}</span>
                  
                  <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Tier</span>
                  <span className="font-bold text-foreground text-right text-sm">{pendingTier.tier_name}</span>
                  
                  <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Qty</span>
                  <span className="font-bold text-foreground text-right text-sm">{quantities[pendingTier.id] || 1}</span>
                  
                  <div className="col-span-2 pt-3 mt-1 border-t border-border">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-foreground font-bold text-sm uppercase tracking-widest">Total ETH</span>
                      <span className="font-bold text-2xl text-primary text-right font-mono">
                        {(pendingTier.price * (quantities[pendingTier.id] || 1)).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-2xl bg-white border border-border p-5 flex items-center gap-5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Origin Wallet</p>
                  <p className="font-mono text-xs truncate text-foreground font-bold">{address}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-8">
              <Button
                variant="outline"
                className="rounded-xl h-12 border-border text-muted-foreground font-bold text-sm hover:bg-muted transition-all"
                onClick={() => { setConfirmOpen(false); setPendingTier(null); }}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl h-12 bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest"
                onClick={() => { setConfirmOpen(false); setChallengeOpen(true); }}
              >
                Authorize
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
