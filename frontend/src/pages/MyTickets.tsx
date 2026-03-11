import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Ticket,
  QrCode,
  Calendar,
  MapPin,
  Tag,
  ArrowUpRight,
  LayoutGrid,
  List,
  ShieldCheck,
  Link2,
  Copy,
  CheckCheck,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  Input, Separator,
} from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInHours } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import NFTTicketCard from "@/components/NFTTicketCard";
import DynamicQRDisplay from "@/components/DynamicQRDisplay";
import { ticketDB, localDB } from "@/lib/localDB";
import { generateTicketPDF } from "@/lib/generateTicketPDF";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [resalePrice, setResalePrice] = useState("");
  const [listingTicket, setListingTicket] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("gallery");
  const [selectedNFT, setSelectedNFT] = useState<TicketWithDetails | null>(null);
  const [galleryQRTicket, setGalleryQRTicket] = useState<TicketWithDetails | null>(null);
  const [galleryResellTicket, setGalleryResellTicket] = useState<TicketWithDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Track which list-view QR dialog is open (for active prop)
  const [openQRTicketId, setOpenQRTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      setTickets(ticketDB.getTickets(userId) as any);
    }
    setLoading(false);
  }, [userId]);

  const handleListForResale = async (_ticketId: string, _facePrice: number) => {
    toast({ title: "Feature coming soon", description: "Resale listing is not yet available.", variant: "destructive" });
  };

  const isQRActive = (eventDate: string) => {
    return differenceInHours(new Date(eventDate), new Date()) <= 24;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {/* Header with view toggle */}
        <div className="flex items-start justify-between mb-2 gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Tickets</h1>
            <p className="text-muted-foreground mt-1">Your on-chain NFT ticket collection</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 border border-muted/40">
            <Button
              variant={viewMode === "gallery" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setViewMode("gallery")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Gallery
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" /> List
            </Button>
          </div>
        </div>

        {/* NFT count badge */}
        {tickets.length > 0 && (
          <div className="flex items-center gap-2 mb-8">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              {tickets.length} NFT{tickets.length !== 1 ? "s" : ""} owned
            </Badge>
          </div>
        )}

        {loading ? (
          <div className={viewMode === "gallery" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
            {[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-64 animate-pulse" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Tickets Yet</h3>
            <p className="text-muted-foreground">Browse events to purchase your first ticket.</p>
          </div>
        ) : viewMode === "gallery" ? (
          /* ── Gallery / NFT Card Grid ─────────────────────────────── */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket, i) => (
              <NFTTicketCard
                key={ticket.id}
                ticket={ticket}
                index={i}
                onShowQR={() => setGalleryQRTicket(ticket)}
                onShowResell={() => { setGalleryResellTicket(ticket); setResalePrice(""); }}
                onShowDetails={() => setSelectedNFT(ticket)}
              />
            ))}
          </div>
        ) : (
          /* ── List View ───────────────────────────────────────────── */
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
                  <Dialog
                    open={openQRTicketId === ticket.id}
                    onOpenChange={(o) => setOpenQRTicketId(o ? ticket.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={ticket.status !== "active"}
                        onClick={() => setOpenQRTicketId(ticket.id)}
                      >
                        <QrCode className="h-4 w-4" />
                        QR
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-strong">
                      <DialogHeader>
                        <DialogTitle>Ticket QR Code</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center py-4">
                        {ticket.events && isQRActive(ticket.events.date) ? (
                          <DynamicQRDisplay
                            ticketId={ticket.id}
                            qrSecret={ticket.qr_secret}
                            active={openQRTicketId === ticket.id}
                            venueLat={localDB.getEvent(ticket.events?.id)?.venue_lat}
                            venueLng={localDB.getEvent(ticket.events?.id)?.venue_lng}
                            geoRadiusM={localDB.getEvent(ticket.events?.id)?.geo_radius_m}
                          />
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

                  {/* Download PDF */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={ticket.status !== "active"}
                    onClick={async () => {
                      await generateTicketPDF({
                        ticketId: ticket.id,
                        qrSecret: ticket.qr_secret ?? "",
                        eventName: ticket.events?.name ?? "",
                        eventDate: ticket.events?.date ?? "",
                        venue: ticket.events?.venue ?? "",
                        tierName: ticket.ticket_tiers?.tier_name ?? "",
                        price: ticket.ticket_tiers?.price ?? 0,
                        purchaseTx: ticket.purchase_tx ?? "",
                        tokenId: ticket.token_id ?? "",
                        ownerWallet: address?.toLowerCase() ?? "",
                        purchasedAt: ticket.created_at,
                        eventCode: ticket.id.slice(4, 12).toUpperCase(),
                      });
                    }}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>

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

        {/* ═══ NFT Details Dialog ═══════════════════════════════════ */}
        <Dialog open={!!selectedNFT} onOpenChange={(o) => !o && setSelectedNFT(null)}>
          <DialogContent className="glass-strong max-w-lg !p-0">
            {/* Gradient accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-primary to-cyan-500" />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                  NFT Ticket Details
                </DialogTitle>
              </DialogHeader>
              {selectedNFT && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight truncate">{selectedNFT.events?.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedNFT.ticket_tiers?.tier_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge className={`text-[10px] font-semibold ${statusColors[selectedNFT.status] || ""}`}>
                      {selectedNFT.status}
                    </Badge>
                    <span className="text-xs font-mono text-primary font-semibold">
                      {selectedNFT.ticket_tiers?.price} ETH
                    </span>
                  </div>
                </div>
              )}
            </div>

            {selectedNFT && (
              <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

                {/* On-chain identity fields */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">On-Chain Identity</p>
                  <div className="space-y-2">
                    {[
                      { label: "Token ID", value: selectedNFT.token_id || "N/A", field: "token" },
                      { label: "Transaction Hash", value: selectedNFT.purchase_tx || "N/A", field: "tx" },
                      { label: "Owner Wallet", value: address || "Unknown", field: "wallet" },
                    ].map(({ label, value, field }) => (
                      <div key={field} className="rounded-xl bg-muted/20 border border-white/[0.06] px-4 py-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-foreground/90 min-w-0 break-all leading-relaxed flex-1">{value}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0 rounded-lg hover:bg-white/[0.06]"
                            onClick={() => copyToClipboard(value, field)}
                          >
                            {copiedField === field
                              ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attributes grid */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Attributes</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { trait: "Standard", value: "ERC-721" },
                      { trait: "Network", value: "Ethereum" },
                      { trait: "Status", value: selectedNFT.status },
                      { trait: "Tier", value: selectedNFT.ticket_tiers?.tier_name || "—" },
                      { trait: "Face Value", value: `${selectedNFT.ticket_tiers?.price} ETH` },
                      { trait: "Minted", value: selectedNFT.created_at ? format(new Date(selectedNFT.created_at), "MMM d, yyyy") : "—" },
                    ].map(({ trait, value }) => (
                      <div key={trait} className="rounded-xl bg-muted/20 border border-white/[0.06] px-3 py-3 flex flex-col gap-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{trait}</p>
                        <p className="text-xs font-semibold text-foreground truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chain badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
                  <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/[0.07] rounded-full px-3">
                    ERC-721
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.07] rounded-full px-3">
                    On-Chain NFT
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/[0.07] rounded-full px-3">
                    FairPass Protocol
                  </Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ Gallery QR Dialog ════════════════════════════════════ */}
        <Dialog open={!!galleryQRTicket} onOpenChange={(o) => !o && setGalleryQRTicket(null)}>
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle>Ticket QR Code</DialogTitle>
            </DialogHeader>
            {galleryQRTicket && (
              <div className="flex flex-col items-center py-4">
                {galleryQRTicket.events && isQRActive(galleryQRTicket.events.date) ? (
                  <DynamicQRDisplay
                    ticketId={galleryQRTicket.id}
                    qrSecret={galleryQRTicket.qr_secret}
                    active={!!galleryQRTicket}
                    venueLat={localDB.getEvent(galleryQRTicket.events?.id)?.venue_lat}
                    venueLng={localDB.getEvent(galleryQRTicket.events?.id)?.venue_lng}
                    geoRadiusM={localDB.getEvent(galleryQRTicket.events?.id)?.geo_radius_m}
                  />
                ) : (
                  <>
                    <QrCode className="h-24 w-24 text-muted-foreground/20 mb-4" />
                    <p className="text-muted-foreground text-center">
                      QR code activates 24 hours before the event
                    </p>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ Gallery Resell Dialog ════════════════════════════════ */}
        <Dialog
          open={!!galleryResellTicket}
          onOpenChange={(o) => { if (!o) { setGalleryResellTicket(null); setResalePrice(""); } }}
        >
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle>List NFT for Resale</DialogTitle>
            </DialogHeader>
            {galleryResellTicket && (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {galleryResellTicket.events?.name} — {galleryResellTicket.ticket_tiers?.tier_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Max price: <span className="text-foreground font-medium">{galleryResellTicket.ticket_tiers?.price} ETH</span> (face value)
                </p>
                <Input
                  type="number"
                  placeholder="Price in ETH"
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  step="0.0001"
                  max={galleryResellTicket.ticket_tiers?.price}
                />
                <Button
                  className="w-full gradient-primary"
                  onClick={() => {
                    handleListForResale(galleryResellTicket.id, galleryResellTicket.ticket_tiers?.price || 0);
                    setGalleryResellTicket(null);
                  }}
                >
                  List NFT for Resale
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
};

export default MyTickets;
