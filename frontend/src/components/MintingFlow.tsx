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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
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
            <div className="relative rounded-2xl border border-primary/30 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #080516 0%, #100626 60%, #080516 100%)" }}>
              {/* Inner glow */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: "0 0 80px rgba(124,58,237,0.18) inset" }} />

              <div className="relative p-8 flex flex-col items-center gap-7">
                {/* Animated wallet ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-22 h-22 w-[88px] h-[88px] rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center">
                    <Wallet className="h-9 w-9 text-primary" />
                  </div>
                  {/* Spinning arc */}
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                    style={{ animationDuration: "1s" }} />
                  {/* Pulsing outer ring */}
                  <div className="absolute -inset-3 rounded-full border border-primary/15 animate-ping"
                    style={{ animationDuration: "2.5s" }} />
                </div>

                {/* Title + phase text */}
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">Processing Payment...</h2>
                  <AnimatePresence mode="wait">
                    {phase === "connecting" ? (
                      <motion.div key="conn"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="space-y-0.5">
                        <p className="text-primary font-semibold text-sm">Connecting to Wallet</p>
                        <p className="text-xs text-muted-foreground">Initializing MetaMask session…</p>
                      </motion.div>
                    ) : (
                      <motion.div key="conf"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="space-y-0.5">
                        <p className="text-amber-400 font-semibold text-sm">Confirm transaction in your wallet.</p>
                        <p className="text-xs text-muted-foreground">Check your MetaMask popup to continue</p>
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
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                        s.done ? "bg-primary" : "border border-muted/40 bg-muted/10"
                      }`}>
                        {s.done
                          ? <CheckCircle className="h-3.5 w-3.5 text-white" />
                          : <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
                      </div>
                      <span className={`text-sm transition-colors ${s.done ? "text-foreground" : "text-muted-foreground/60"}`}>
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
            <div className="relative rounded-2xl border border-violet-500/40 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #080516 0%, #0d0a24 50%, #080516 100%)" }}>
              {/* Violet glow */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ boxShadow: "0 0 100px rgba(139,92,246,0.14) inset" }} />

              {/* Floating node dots (blockchain vibe) */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[
                  { size: 40, top: "8%",  left: "4%",  delay: 0 },
                  { size: 24, top: "20%", left: "80%", delay: 0.4 },
                  { size: 56, top: "55%", left: "12%", delay: 0.8 },
                  { size: 32, top: "70%", left: "70%", delay: 0.2 },
                  { size: 20, top: "40%", left: "55%", delay: 0.6 },
                  { size: 48, top: "85%", left: "35%", delay: 1.0 },
                ].map((n, i) => (
                  <div key={i}
                    className="absolute rounded-full bg-violet-500/[0.07] animate-ping"
                    style={{
                      width: n.size, height: n.size,
                      top: n.top, left: n.left,
                      animationDelay: `${n.delay}s`,
                      animationDuration: `${2 + i * 0.4}s`,
                    }} />
                ))}
              </div>

              <div className="relative p-8 flex flex-col items-center gap-6">
                {/* Icon */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center"
                    style={{ boxShadow: "0 0 40px rgba(139,92,246,0.2)" }}>
                    <Ticket className="h-12 w-12 text-violet-400" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl border border-violet-400/20 animate-pulse" />
                  <motion.div
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary border border-primary/50 flex items-center justify-center"
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
                      className="text-lg font-bold text-white tracking-tight"
                    >
                      {STEP2_MESSAGES[messageIdx]}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="text-xs text-muted-foreground/70">This may take a few moments</p>
                </div>

                {/* Progress steps */}
                <div className="w-full space-y-3">
                  {MINTING_STEPS.map((label, i) => {
                    const done   = mintingProgress > i;
                    const active = mintingProgress === i;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        {/* Circle icon */}
                        <motion.div
                          animate={done ? { scale: [1.3, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                            done   ? "bg-neon-green border-0"
                            : active ? "bg-primary/30 border border-primary"
                            :          "bg-muted/15 border border-muted/25"
                          }`}
                        >
                          {done   ? <CheckCircle className="h-3.5 w-3.5 text-white" />
                          : active ? <Loader2 className="h-3 w-3 text-primary animate-spin" />
                          : null}
                        </motion.div>

                        {/* Progress bar */}
                        <div className="flex-1 h-1 rounded-full bg-muted/15 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${done ? "bg-neon-green" : active ? "bg-primary/60" : "bg-transparent"}`}
                            initial={{ width: "0%" }}
                            animate={{ width: done ? "100%" : active ? "65%" : "0%" }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                          />
                        </div>

                        {/* Label */}
                        <span className={`text-xs w-36 text-right transition-colors ${
                          done   ? "text-neon-green font-medium"
                          : active ? "text-primary"
                          :          "text-muted-foreground/40"
                        }`}>
                          {label}{done ? " ✔" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated network hash */}
                <div className="w-full rounded-xl bg-muted/[0.07] border border-white/[0.05] px-4 py-3">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest mb-1.5">Network Activity</p>
                  <motion.p
                    className="font-mono text-[11px] text-violet-400/70 truncate"
                    animate={{ opacity: [0.7, 0.4, 0.7] }}
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
            <div className="relative rounded-2xl border border-neon-green/25 overflow-hidden"
              style={{ background: "linear-gradient(160deg, #080516 0%, #05140b 55%, #080516 100%)" }}>
              {/* Top gradient bar */}
              <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-primary to-neon-green" />

              {/* Subtle green glow */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ boxShadow: "0 0 100px rgba(74,222,128,0.06) inset" }} />

              <div className="relative p-6 space-y-5">
                {/* ── Header ── */}
                <div className="text-center space-y-3 pt-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, delay: 0.08 }}
                    className="w-16 h-16 rounded-full bg-neon-green/10 border-2 border-neon-green/35 flex items-center justify-center mx-auto"
                    style={{ boxShadow: "0 0 32px rgba(74,222,128,0.22)" }}
                  >
                    <CheckCircle className="h-8 w-8 text-neon-green" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-neon-green">
                      {mintResult.qty > 1 ? `${mintResult.qty} Tickets` : "Ticket"} Minted Successfully
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Your NFT is secured on the Ethereum blockchain
                    </p>
                  </div>
                </div>

                {/* ── Ticket details table ── */}
                <div className="rounded-xl border border-white/[0.07] overflow-hidden divide-y divide-white/[0.05]"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  {[
                    { label: "Event",            value: mintResult.eventName,                                      mono: false },
                    { label: "Tier",             value: mintResult.tierName,                                       mono: false },
                    { label: "Token ID",         value: `#${ticket?.tokenId.slice(0, 18)}`,                       mono: true, color: "text-primary" },
                    { label: "Transaction Hash", value: `${ticket?.purchaseTx.slice(0,14)}…${ticket?.purchaseTx.slice(-8)}`, mono: true },
                    { label: "Block Number",     value: `#${mintResult.blockNumber.toLocaleString()}`,              mono: true, color: "text-violet-400" },
                    { label: "Wallet",           value: ownerAddress ? `${ownerAddress.slice(0,8)}…${ownerAddress.slice(-6)}` : "—", mono: true },
                  ].map(({ label, value, mono, color }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                      <span className={`text-sm font-medium text-right break-all leading-snug ${mono ? "font-mono text-xs" : ""} ${color ?? "text-foreground"}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Action buttons ── */}
                <div className="space-y-2 pt-1">
                  <Button variant="outline"
                    className="w-full gap-2 border-white/10 hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => window.open(`https://etherscan.io/tx/${ticket?.purchaseTx}`, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" /> View on Etherscan
                  </Button>
                  <Button variant="outline"
                    className="w-full gap-2 border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5"
                    disabled={downloading}
                    onClick={async () => { setDownloading(true); await onDownloadPDF(); setDownloading(false); }}
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? "Generating PDF…" : `Download Ticket${mintResult.qty > 1 ? "s" : ""} PDF`}
                  </Button>
                  <Button variant="outline"
                    className="w-full gap-2 border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                    onClick={() => setQrOpen(true)}
                  >
                    <QrCode className="h-4 w-4" /> Open Entry QR
                  </Button>
                  <Button className="w-full gradient-primary gap-2"
                    onClick={onGoToTickets}
                  >
                    <Ticket className="h-4 w-4" /> Go to My Tickets
                  </Button>
                </div>

                {/* ── Security note ── */}
                <div className="rounded-xl border border-white/[0.06] px-4 py-3 flex items-start gap-2.5"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
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
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" /> Entry QR Code
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-4 gap-4">
              <DynamicQRDisplay
                ticketId={ticket.id}
                qrSecret={ticket.qrSecret}
                active={qrOpen}
              />
              <p className="text-xs text-muted-foreground text-center">
                QR rotates every 30 seconds — do not screenshot
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
