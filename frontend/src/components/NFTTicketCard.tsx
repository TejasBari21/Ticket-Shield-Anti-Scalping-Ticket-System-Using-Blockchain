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
} from "lucide-react";
import { format } from "date-fns";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 120 }}
      className="relative rounded-2xl overflow-hidden group cursor-default"
      style={{ background: "hsl(var(--card))" }}
    >
      {/* Holographic gradient top border */}
      <div className={`h-1 w-full bg-gradient-to-r ${holoGradient}`} />

      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-500/[0.04] pointer-events-none rounded-2xl" />

      {/* Shimmer overlay on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none rounded-2xl" />

      <div className="p-5 relative">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
                NFT Ticket
              </span>
            </div>
            <h3 className="font-bold text-base leading-snug truncate pr-2">
              {ticket.events?.name}
            </h3>
          </div>

          {/* Token ID badge */}
          <div className="flex-shrink-0 border border-primary/25 bg-primary/[0.08] rounded-xl px-2.5 py-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none mb-1">
              Token
            </p>
            <p className="font-mono font-bold text-primary text-[11px] leading-none">
              {tokenDisplay}
            </p>
          </div>
        </div>

        {/* ── Event Details ──────────────────────────────── */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tag className="h-3 w-3 flex-shrink-0" />
            <span>
              {ticket.ticket_tiers?.tier_name}
              <span className="mx-1.5 opacity-40">·</span>
              {ticket.ticket_tiers?.price} ETH
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>
              {ticket.events &&
                format(new Date(ticket.events.date), "MMM d, yyyy · h:mm a")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{ticket.events?.venue}</span>
          </div>
        </div>

        {/* ── Badges ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <Badge
            className={`text-[10px] border ${statusStyles[ticket.status] || ""}`}
          >
            {ticket.status}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/[0.07]"
          >
            ERC-721
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.07]"
          >
            On-Chain
          </Badge>
        </div>

        {/* ── TX Hash ────────────────────────────────────── */}
        {txShort && (
          <div className="mb-4 rounded-lg bg-muted/30 px-3 py-2 border border-muted/40">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Link2 className="h-2.5 w-2.5 text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Transaction
              </p>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground">{txShort}</p>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────── */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs h-8"
            disabled={ticket.status !== "active"}
            onClick={onShowQR}
          >
            <QrCode className="h-3.5 w-3.5" />
            QR Code
          </Button>

          {ticket.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={onShowResell}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Resell
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
            title="View NFT Details"
            onClick={onShowDetails}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default NFTTicketCard;
