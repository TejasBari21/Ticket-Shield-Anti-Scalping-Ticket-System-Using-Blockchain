import { useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Ticket, ArrowLeftRight, CheckCircle, XCircle, Calendar, Zap, Wifi, WifiOff, Trash2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { type MonitoredTransaction, type TxEventType } from "@/hooks/useTransactionMonitor";

// ── Metadata per event type ───────────────────────────────────────────────────

const TX_META: Record<
  TxEventType,
  { icon: React.ElementType; label: string; color: string; badgeClass: string }
> = {
  TicketMinted: {
    icon: Ticket,
    label: "Minted",
    color: "text-neon-green",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  ResaleCompleted: {
    icon: ArrowLeftRight,
    label: "Resale",
    color: "text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  ResaleOffered: {
    icon: ArrowLeftRight,
    label: "Listed",
    color: "text-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  ResaleOfferCancelled: {
    icon: XCircle,
    label: "Delisted",
    color: "text-rose-400",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  TicketCheckedIn: {
    icon: CheckCircle,
    label: "Check-In",
    color: "text-cyan-400",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  EventCreated: {
    icon: Calendar,
    label: "New Event",
    color: "text-purple-400",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
};

// ── Single row ────────────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: MonitoredTransaction }) {
  const meta = TX_META[tx.type];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
      <div className={`mt-0.5 h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center bg-current/10 ${meta.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{tx.summary}</span>
          <Badge className={`text-[10px] px-1.5 py-0 border ${meta.badgeClass}`}>
            {meta.label}
          </Badge>
          {tx.priceEth && (
            <span className="text-xs font-mono text-muted-foreground">
              {parseFloat(tx.priceEth).toFixed(4)} ETH
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.detail}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground/60">
            {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
          </span>
          <span className="text-[10px] text-muted-foreground/40">·</span>
          <a
            href={`https://etherscan.io/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-primary/60 hover:text-primary truncate max-w-[120px]"
            title={tx.txHash}
          >
            {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── TransactionFeed ───────────────────────────────────────────────────────────

interface TransactionFeedProps {
  transactions: MonitoredTransaction[];
  isListening: boolean;
  error: string | null;
  onClear: () => void;
  /** Max visible rows without scrolling (defaults to 8) */
  maxVisible?: number;
}

export function TransactionFeed({
  transactions,
  isListening,
  error,
  onClear,
  maxVisible = 8,
}: TransactionFeedProps) {
  // Auto-scroll to top when new transaction arrives
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [transactions.length]);

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Live Transactions</span>
          {transactions.length > 0 && (
            <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5">
              {transactions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          {isListening ? (
            <div className="flex items-center gap-1 text-emerald-400">
              <Wifi className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Live</span>
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="text-[11px]">Offline</span>
            </div>
          )}
          {transactions.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={onClear}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Feed */}
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ maxHeight: `${maxVisible * 72}px` }}
      >
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Zap className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">
              {isListening
                ? "Waiting for blockchain events…"
                : "Connect wallet to monitor transactions"}
            </p>
          </div>
        ) : (
          transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
        )}
      </div>
    </div>
  );
}
