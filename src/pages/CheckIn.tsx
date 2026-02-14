import { useState } from "react";
import { motion } from "framer-motion";
import { ScanLine, CheckCircle, XCircle, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  valid: boolean;
  message: string;
  ticket?: any;
  event?: any;
}

const CheckIn = () => {
  const { isConnected, userId } = useWallet();
  const { toast } = useToast();
  const [qrInput, setQrInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!qrInput.trim()) return;
    setChecking(true);
    setResult(null);

    try {
      let parsed: { ticketId: string; secret: string };
      try {
        parsed = JSON.parse(qrInput);
      } catch {
        setResult({ valid: false, message: "Invalid QR code format" });
        return;
      }

      // Look up ticket
      const { data: ticket } = await supabase
        .from("tickets")
        .select("*, events(id, name, date, venue), ticket_tiers(tier_name)")
        .eq("id", parsed.ticketId)
        .single();

      if (!ticket) {
        setResult({ valid: false, message: "Ticket not found" });
        return;
      }

      if ((ticket as any).qr_secret !== parsed.secret) {
        setResult({ valid: false, message: "Invalid ticket secret" });
        return;
      }

      if ((ticket as any).status === "used") {
        setResult({ valid: false, message: "Ticket already used", ticket });
        return;
      }

      if ((ticket as any).status !== "active") {
        setResult({ valid: false, message: `Ticket status: ${(ticket as any).status}`, ticket });
        return;
      }

      // Check in
      const { error: checkInError } = await supabase.from("check_ins").insert({
        ticket_id: (ticket as any).id,
        event_id: (ticket as any).event_id,
        checked_in_by: userId,
      });

      if (checkInError) {
        if (checkInError.message.includes("duplicate")) {
          setResult({ valid: false, message: "Ticket already checked in", ticket });
        } else {
          throw checkInError;
        }
        return;
      }

      // Mark ticket as used
      await supabase.from("tickets").update({ status: "used" as any }).eq("id", (ticket as any).id);

      setResult({
        valid: true,
        message: "Check-in successful!",
        ticket,
        event: (ticket as any).events,
      });
      toast({ title: "✅ Check-in Verified" });
    } catch (err: any) {
      setResult({ valid: false, message: err.message || "Verification failed" });
    } finally {
      setChecking(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20">
        <ScanLine className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Connect Wallet</h2>
        <p className="text-muted-foreground">Staff access required for check-in.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-2 text-center">Check-in Verification</h1>
        <p className="text-muted-foreground mb-8 text-center">Scan or paste ticket QR code data</p>

        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ScanLine className="h-12 w-12 text-primary" />
          </div>

          <div className="space-y-3">
            <Input
              placeholder='Paste QR data: {"ticketId":"...","secret":"..."}'
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              className="w-full gradient-primary hover:opacity-90"
              onClick={handleVerify}
              disabled={checking || !qrInput.trim()}
            >
              {checking ? "Verifying..." : "Verify Ticket"}
            </Button>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl p-6 text-center ${
                result.valid
                  ? "bg-neon-green/10 border border-neon-green/30"
                  : "bg-destructive/10 border border-destructive/30"
              }`}
            >
              {result.valid ? (
                <CheckCircle className="h-12 w-12 text-neon-green mx-auto mb-3" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              )}
              <p className="font-semibold text-lg mb-2">{result.message}</p>
              {result.event && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{result.event.name}</p>
                  <p>{result.event.venue}</p>
                  {result.ticket?.owner_wallet && (
                    <p className="font-mono text-xs">
                      Wallet: {result.ticket.owner_wallet.slice(0, 6)}...{result.ticket.owner_wallet.slice(-4)}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CheckIn;
