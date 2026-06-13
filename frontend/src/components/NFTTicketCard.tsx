import { motion } from "framer-motion";
import { Badge, Button } from "@/components/ui";
import {
  QrCode,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  MapPin,
  Tag,
  Link2,
  Clock,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { formatTicketTimestamp, formatTicketDate, formatTicketTime } from "@/lib/ticketTimestamp";

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

interface NFTTicketCardProps {
  ticket: TicketWithDetails;
  index: number;
  onShowQR: () => void;
  onShowResell: () => void;
  onShowDetails: () => void;
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  used: "bg-muted/40 text-muted-foreground border-muted",
  listed: "bg-primary/20 text-primary border-primary/30",
  expired: "bg-destructive/20 text-destructive border-destructive/30",
};

// Hue shift per card for rainbow holographic shimmer
const holoBorders = [
  "from-violet-500 via-primary to-cyan-500",
  "from-pink-500 via-violet-500 to-indigo-500",
  "from-cyan-500 via-emerald-400 to-violet-500",
  "from-amber-400 via-orange-500 to-pink-500",
];

/**
 * Professional NFT Ticket Card Component
 * Displays ticket information in a premium pass-style layout
 */
const NFTTicketCard = ({
  ticket,
  index,
  onShowQR,
  onShowResell,
  onShowDetails,
}: NFTTicketCardProps) => {
  const tokenDisplay = ticket.token_id
    ? `#${ticket.token_id.slice(0, 10)}`
    : "#–––";

  const txShort = ticket.purchase_tx
    ? `${ticket.purchase_tx.slice(0, 12)}…${ticket.purchase_tx.slice(-6)}`
    : null;

  const holoGradient = holoBorders[index % holoBorders.length];

  // Format dates for display
  const eventDate = ticket.events?.date ? formatTicketDate(ticket.events.date) : "N/A";
  const eventTime = ticket.events?.date ? formatTicketTime(ticket.events.date) : "N/A";
  const bookedAt = formatTicketTimestamp(ticket.created_at);

  // Status indicator
  const statusLabel = ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1);
  const isActive = ticket.status === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 120 }}
      className="relative rounded-2xl overflow-hidden group cursor-default"
      style={{ background: "hsl(var(--card))" }}
    >
      {/* Premium gradient border */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${holoGradient}`} />

      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-500/[0.04] pointer-events-none" />

      {/* Shimmer overlay on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="p-5 relative space-y-4">
        {/* ═══════════════════════════════════════════════════════
            HEADER SECTION: Event Name + Status Badge
        ═══════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
                NFT Ticket
              </span>
            </div>
            <h3 className="font-bold text-sm leading-snug pr-2">
              {ticket.events?.name}
            </h3>
          </div>

          {/* Status Badge */}
          <div className="flex-shrink-0">
            <Badge
              className={`text-[9px] border font-bold flex items-center gap-1 ${
                statusStyles[ticket.status] || "bg-muted/30 text-muted-foreground border-muted"
              }`}
            >
              {isActive && <CheckCircle className="h-3 w-3" />}
              {statusLabel.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TOKEN SECTION: Token ID Badge
        ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-border/50 pt-3">
          <div className="inline-flex border border-primary/25 bg-primary/[0.08] rounded-lg px-3 py-2">
            <div className="text-center">
              <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold leading-none mb-1.5">
                Token ID
              </p>
              <p className="font-mono font-bold text-primary text-[10px] leading-none">
                {tokenDisplay}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            EVENT DETAILS SECTION
        ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-border/50 pt-3 space-y-2.5">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-primary/60 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                Event Date & Time
              </p>
              <p className="text-xs font-semibold text-foreground">
                {eventDate}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {eventTime}
              </p>
            </div>
          </div>

          {/* Venue */}
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-primary/60 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                Venue & Location
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {ticket.events?.venue}
              </p>
              {ticket.events?.location && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {ticket.events.location}
                </p>
              )}
            </div>
          </div>

          {/* Tier & Price */}
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 text-primary/60 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                Ticket Tier & Price
              </p>
              <p className="text-xs font-semibold text-foreground">
                {ticket.ticket_tiers?.tier_name}
                <span className="mx-2 opacity-40">·</span>
                <span className="text-primary font-bold">{ticket.ticket_tiers?.price} ETH</span>
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            BOOKING INFO SECTION
        ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-border/50 pt-3">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-primary/60 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                Booked On
              </p>
              <p className="text-xs font-semibold text-foreground">
                {bookedAt}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TRANSACTION SECTION (if available)
        ═══════════════════════════════════════════════════════ */}
        {txShort && (
          <div className="border-t border-border/50 pt-3">
            <div className="rounded-lg bg-muted/20 border border-muted/40 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">
                  Transaction
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground break-all">
                {txShort}
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            ACTION BUTTONS
        ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-border/50 pt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 disabled:opacity-50"
            disabled={!isActive}
            onClick={onShowQR}
            title={isActive ? "Show QR Code for entry" : "Only active tickets can be scanned"}
          >
            <QrCode className="h-3.5 w-3.5" />
            QR Code
          </Button>

          {isActive && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={onShowResell}
              title="List ticket for resale"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Resell
            </Button>
          )}

          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
              onClick={onShowDetails}
              title="View details"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Details
            </Button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            OTHER BADGES (ERC-721, On-Chain)
        ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-border/50 pt-3 flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="text-[9px] border-violet-500/30 text-violet-400 bg-violet-500/[0.07]"
          >
            ERC-721
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.07]"
          >
            On-Chain
          </Badge>
        </div>
      </div>
    </motion.div>
  );
};

export default NFTTicketCard;
