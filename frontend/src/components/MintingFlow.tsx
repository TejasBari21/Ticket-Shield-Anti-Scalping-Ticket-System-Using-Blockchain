/**
 * MintingFlow — 3-step Web3 minting overlay
 * Step 1: Payment Processing  (wallet + MetaMask prompt)
 * Step 2: NFT Minting Animation (blockchain progress)
 * Step 3: Mint Confirmation  (success card + actions)
 */
import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle, Wallet, ExternalLink, Download, QrCode,
  Ticket, Zap, Shield, Loader2,
} from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import DynamicQRDisplay from "@/components/DynamicQRDisplay";

/* ── Public types ─────────────────────────────────────────────────── */

export interface MintResult {
  eventName: string;
  eventDate: string;
  venue: string;
  tierName: string;
  tierPrice: number;
  qty: number;
  blockNumber: number;
  eventImageUrl?: string | null;
  tickets: Array<{
    id: string;
    tokenId: string;
    purchaseTx: string;
    qrSecret: string;
  }>;
}

interface MintingFlowProps {
  /** 0 = hidden, 1 = processing, 2 = minting, 3 = success */
  step: 0 | 1 | 2 | 3;
  mintResult: MintResult | null;
  ownerAddress: string | null;
  onDownloadPDF: () => Promise<void>;
  onGoToTickets: () => void;
}

/* ── Constants ────────────────────────────────────────────────────── */

const MINTING_STEPS = [
  "Wallet Confirmed",
  "Minting NFT Ticket",
  "Blockchain Confirmation",
  "Ticket Ready",
];

const STEP2_MESSAGES = [
  "Minting your NFT Ticket...",
  "Writing transaction to blockchain...",
  "Waiting for block confirmation...",
  "Finalizing mint...",
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function randomHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/* ── Component ────────────────────────────────────────────────────── */

export default function MintingFlow({
  step, mintResult, ownerAddress, onDownloadPDF, onGoToTickets,
}: MintingFlowProps) {
  const [mintingProgress, setMintingProgress] = useState(0);
  const [messageIdx, setMessageIdx]           = useState(0);
  const [phase, setPhase]                     = useState<"connecting" | "confirming">("connecting");
  const [qrOpen, setQrOpen]                   = useState(false);
  const [downloading, setDownloading]         = useState(false);

  // Stable fake hash — regenerated each time step 2 is entered
  const networkHash = useMemo(() => "0x" + randomHex(62), [step]);

  /* Step 1 sub-phases */
  useEffect(() => {
    if (step !== 1) { setPhase("connecting"); return; }
    const t = setTimeout(() => setPhase("confirming"), 1300);
    return () => clearTimeout(t);
  }, [step]);

  /* Step 2 progress bar */
  useEffect(() => {
    if (step !== 2) { setMintingProgress(0); return; }
    const timers = MINTING_STEPS.map((_, i) =>
      setTimeout(() => setMintingProgress(i + 1), i * 950),
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  /* Step 2 message cycling */
  useEffect(() => {
    if (step !== 2) { setMessageIdx(0); return; }
    const id = setInterval(
      () => setMessageIdx(p => (p + 1) % STEP2_MESSAGES.length),
      1100,
    );
    return () => clearInterval(id);
  }, [step]);

  if (step === 0) return null;

  const ticket = mintResult?.tickets[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════════════
            STEP 1 – Payment Processing
        ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <motion.div key="s1"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="relative p-8 flex flex-col items-center gap-7">
                {/* Animated wallet ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-[88px] h-[88px] rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center shadow-lg shadow-primary/10">
                    <Wallet className="h-9 w-9 text-[#1BA6A6]" />
                  </div>
                  {/* Spinning arc */}
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1BA6A6] animate-spin"
                    style={{ animationDuration: "1s" }} />
                  {/* Pulsing outer ring */}
                  <div className="absolute -inset-3 rounded-full border border-primary/10 animate-ping"
                    style={{ animationDuration: "2.5s" }} />
                </div>

                {/* Title + phase text */}
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-foreground tracking-tight">Processing Payment...</h2>
                  <AnimatePresence mode="wait">
                    {phase === "connecting" ? (
                      <motion.div key="conn"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="space-y-0.5">
                      <p className="text-primary font-bold text-sm">Connecting to Wallet</p>
                        <p className="text-xs text-muted-foreground font-medium">Initializing MetaMask session…</p>
                      </motion.div>
                    ) : (
                      <motion.div key="conf"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="space-y-0.5">
                        <p className="text-amber-500 font-bold text-sm">Confirm transaction in your wallet.</p>
                        <p className="text-xs text-muted-foreground font-medium">Check your MetaMask popup to continue</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Checklist */}
                <div className="w-full space-y-2.5">
                  {[
                    { label: "Wallet Connected",      done: true },
                    { label: "Transaction Submitted",  done: phase === "confirming" },
                    { label: "Awaiting Signature",     done: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 shadow-sm ${
                        s.done ? "bg-[#1BA6A6]" : "border border-border bg-muted/50"
                      }`}>
                        {s.done
                          ? <CheckCircle className="h-3.5 w-3.5 text-white" />
                          : <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
                      </div>
                      <span className={`text-sm transition-colors font-medium ${s.done ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP 2 – NFT Minting Animation
        ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <motion.div key="s2"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md"
          >
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="relative p-8 flex flex-col items-center gap-6">
                {/* Icon */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-[#1BA6A6]/5 border border-[#1BA6A6]/10 flex items-center justify-center shadow-lg shadow-primary/5">
                    <Ticket className="h-12 w-12 text-[#1BA6A6]" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl border border-primary/20 animate-pulse" />
                  <motion.div
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#1BA6A6] border border-white flex items-center justify-center shadow-lg"
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9 }}
                  >
                    <Zap className="h-4 w-4 text-white" />
                  </motion.div>
                </div>

                {/* Cycling message */}
                <div className="text-center min-h-[52px] flex flex-col items-center justify-center gap-1">
                  <AnimatePresence mode="wait">
                    <motion.h2 key={messageIdx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="text-lg font-bold text-foreground tracking-tight"
                    >
                      {STEP2_MESSAGES[messageIdx]}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="text-xs text-muted-foreground font-medium tracking-wide">Secure Blockchain Validation</p>
                </div>

                {/* Progress steps */}
                <div className="w-full space-y-3.5">
                  {MINTING_STEPS.map((label, i) => {
                    const done   = mintingProgress > i;
                    const active = mintingProgress === i;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        {/* Circle icon */}
                        <motion.div
                          animate={done ? { scale: [1.3, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 shadow-sm ${
                            done   ? "bg-[#1BA6A6] border-0"
                            : active ? "bg-[#1BA6A6]/10 border border-[#1BA6A6]/30"
                            :          "bg-[#F5F7F8] border border-border"
                          }`}
                        >
                          {done   ? <CheckCircle className="h-3.5 w-3.5 text-white" />
                          : active ? <Loader2 className="h-3 w-3 text-primary animate-spin" />
                          : null}
                        </motion.div>

                        {/* Progress bar */}
                        <div className="flex-1 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${done ? "bg-primary" : active ? "bg-primary/50" : "bg-transparent"}`}
                            style={{ background: done ? "linear-gradient(90deg, #1BA6A6, #7ED4D4)" : undefined }}
                            initial={{ width: "0%" }}
                            animate={{ width: done ? "100%" : active ? "65%" : "0%" }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                          />
                        </div>

                        {/* Label */}
                        <span className={`text-[11px] w-36 text-right transition-colors uppercase tracking-wider font-bold ${
                          done   ? "text-primary"
                          : active ? "text-primary opacity-70"
                          :          "text-muted-foreground"
                        }`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated network hash */}
                <div className="w-full rounded-xl bg-muted border border-border px-4 py-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-1.5">Network Activity</p>
                  <motion.p
                    className="font-mono text-[11px] text-primary/70 truncate"
                    animate={{ opacity: [0.8, 0.4, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                  >
                    {networkHash}
                  </motion.p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP 3 – Mint Confirmation
        ══════════════════════════════════════════════════════════ */}
        {step === 3 && mintResult && (
          <motion.div key="s3"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 180 }}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto"
          >
            <div className="relative rounded-[2rem] border border-border bg-card shadow-2xl overflow-hidden">
              {/* Top gradient bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#1BA6A6] to-[#7ED4D4]" />

              <div className="relative p-8 space-y-6">
                {/* ── Header ── */}
                <div className="text-center space-y-4 pt-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, delay: 0.08 }}
                    className="w-20 h-20 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center mx-auto shadow-lg shadow-primary/5"
                  >
                    <CheckCircle className="h-10 w-10 text-[#1BA6A6]" />
                  </motion.div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                      {mintResult.qty > 1 ? `${mintResult.qty} Tickets` : "Ticket"} Minted Successfully
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium">
                      Your NFT is secured on the Ethereum blockchain
                    </p>
                  </div>
                </div>

                {/* ── Ticket details table ── */}
                <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border bg-[#F5F7F8]/50">
                  {[
                    { label: "Event",            value: mintResult.eventName,                                      mono: false },
                    { label: "Tier",             value: mintResult.tierName,                                       mono: false },
                    { label: "Token ID",         value: `#${ticket?.tokenId.slice(0, 18)}`,                       mono: true, color: "text-[#1BA6A6]" },
                    { label: "Transaction Hash", value: `${ticket?.purchaseTx.slice(0,14)}…${ticket?.purchaseTx.slice(-8)}`, mono: true },
                    { label: "Block Number",     value: `#${mintResult.blockNumber.toLocaleString()}`,              mono: true, color: "text-[#1BA6A6]" },
                    { label: "Wallet",           value: ownerAddress ? `${ownerAddress.slice(0,8)}…${ownerAddress.slice(-6)}` : "—", mono: true },
                  ].map(({ label, value, mono, color }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-4 gap-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex-shrink-0">{label}</span>
                      <span className={`text-[13px] font-bold text-right break-all leading-snug ${mono ? "font-mono" : ""} ${color ?? "text-foreground"}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Action buttons ── */}
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline"
                      className="w-full h-12 gap-2 rounded-xl border-border bg-white text-foreground font-bold hover:bg-muted shadow-sm"
                      onClick={() => window.open(`https://etherscan.io/tx/${ticket?.purchaseTx}`, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-4 w-4" /> Explorer
                    </Button>
                    <Button variant="outline"
                      className="w-full h-12 gap-2 rounded-xl border-border bg-white text-foreground font-bold hover:bg-muted shadow-sm"
                      disabled={downloading}
                      onClick={async () => { setDownloading(true); await onDownloadPDF(); setDownloading(false); }}
                    >
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                  </div>
                  <Button variant="outline"
                    className="w-full h-12 gap-2 rounded-xl border-border bg-white text-foreground font-bold hover:bg-muted shadow-sm"
                    onClick={() => setQrOpen(true)}
                  >
                    <QrCode className="h-4 w-4" /> Open Entry QR
                  </Button>
                  <Button className="w-full h-14 rounded-xl bg-primary gap-2 font-bold text-white shadow-xl shadow-primary/20 hover:opacity-95 uppercase tracking-widest"
                    onClick={onGoToTickets}
                  >
                    <Ticket className="h-5 w-5" /> Go to My Tickets
                  </Button>
                </div>

                {/* ── Security note ── */ }
                <div className="rounded-2xl border border-primary/10 px-5 py-4 flex items-start gap-3.5 bg-primary/[0.02]">
                  <Shield className="h-5 w-5 text-[#1BA6A6] flex-shrink-0 mt-0.5 shadow-sm" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                    This NFT ticket is securely stored on the blockchain and linked to your wallet.
                    The QR code refreshes every 30 seconds to prevent fraud or screenshot misuse.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Entry QR Dialog ─────────────────────────────────────────── */}
      {ticket && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="bg-white border-[#E5E7EB] rounded-[2rem] p-8 max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#1F2933]">
                <QrCode className="h-6 w-6 text-[#1BA6A6]" /> Entry QR
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 gap-6">
              <div className="p-4 bg-[#F5F7F8] rounded-[2rem] border border-[#E5E7EB] shadow-inner">
                <DynamicQRDisplay
                  ticketId={ticket.id}
                  qrSecret={ticket.qrSecret}
                  active={qrOpen}
                />
              </div>
              <p className="text-xs text-[#6B7280] text-center font-bold uppercase tracking-widest px-4">
                QR rotates every 30 seconds — screenshot use prohibited
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
