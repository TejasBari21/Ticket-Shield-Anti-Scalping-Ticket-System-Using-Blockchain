import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ScanLine, CheckCircle, XCircle, ShieldCheck, Clock, ArrowLeft, MapPin, Navigation, Navigation2 } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { verifyQRToken, QR_WINDOW_MS, type DynamicQRPayload } from "@/hooks/useDynamicQR";
import { ticketDB, localDB, auditLogDB } from "@/lib/localDB";
import { haversineMetres } from "@/lib/utils";

interface VerificationResult {
  valid: boolean;
  message: string;
  detail?: string;
  ticket?: ReturnType<typeof ticketDB.getTicketById>;
  eventName?: string;
  venueName?: string;
}

type StaffGeo =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; distanceM: number; venueName: string }
  | { status: "far"; distanceM: number; radiusM: number; venueName: string }
  | { status: "error"; message: string };

const CheckIn = () => {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { toast } = useToast();
  const [qrInput, setQrInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [staffGeo, setStaffGeo] = useState<StaffGeo>({ status: "idle" });

  const checkStaffLocation = useCallback((eventId?: string) => {
    const event = eventId ? localDB.getEvent(eventId) : null;
    if (!event?.venue_lat || !event?.venue_lng) {
      setStaffGeo({ status: "idle" }); // no geo-lock on this event
      return;
    }
    if (!navigator.geolocation) {
      setStaffGeo({ status: "error", message: "Geolocation not supported" });
      return;
    }
    setStaffGeo({ status: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineMetres(
          pos.coords.latitude, pos.coords.longitude,
          event.venue_lat!, event.venue_lng!,
        );
        const radius = event.geo_radius_m ?? 300;
        if (dist <= radius) {
          setStaffGeo({ status: "ok", distanceM: Math.round(dist), venueName: event.venue });
        } else {
          setStaffGeo({ status: "far", distanceM: Math.round(dist), radiusM: radius, venueName: event.venue });
        }
      },
      (err) => setStaffGeo({ status: "error", message: err.message }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const handleVerify = async () => {
    if (!qrInput.trim()) return;
    setChecking(true);
    setResult(null);
    setStaffGeo({ status: "idle" });

    try {
      // â”€â”€ 1. Parse QR payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let parsed: Partial<DynamicQRPayload> & { secret?: string };
      try {
        parsed = JSON.parse(qrInput.trim());
      } catch {
        setResult({ valid: false, message: "Invalid QR format", detail: "Could not parse JSON payload." });
        return;
      }

      if (!parsed.ticketId) {
        setResult({ valid: false, message: "Missing ticketId in QR payload" });
        return;
      }

      // â”€â”€ 2. Look up ticket in localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const ticket = ticketDB.getTicketById(parsed.ticketId);
      if (!ticket) {
        setResult({ valid: false, message: "Ticket not found", detail: "This ticket ID does not exist." });
        return;
      }

      // â”€â”€ 3. Already used? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (ticket.status === "used") {
        setResult({
          valid: false,
          message: "Ticket already used",
          detail: "This ticket was already checked in.",
          ticket,
          eventName: ticket.events?.name,
          venueName: ticket.events?.venue,
        });
        return;
      }

      // â”€â”€ 4. Verify HMAC token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const nowWindow = Math.floor(Date.now() / QR_WINDOW_MS);
      const windowToCheck = typeof parsed.window === "number" ? parsed.window : nowWindow;

      if (parsed.token) {
        // Dynamic QR: verify HMAC
        const valid = await verifyQRToken(ticket.qr_secret, windowToCheck, parsed.token);
        if (!valid) {
          setResult({ valid: false, message: "Invalid or expired QR code", detail: "HMAC verification failed. Token may have expired." });
          return;
        }
      } else {
        // No token present â€” reject (legacy format not supported)
        setResult({ valid: false, message: "Missing HMAC token", detail: "QR code is missing security token." });
        return;
      }

      // â”€â”€ 5. Check geo-lock (if event has coordinates) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const event = localDB.getEvent(ticket.event_id);
      if (event?.venue_lat && event?.venue_lng) {
        if (!navigator.geolocation) {
          setResult({ valid: false, message: "Geo-lock active but geolocation unavailable", detail: "This event requires location verification." });
          return;
        }
        const pos: GeolocationPosition = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10_000 })
        );
        const dist = haversineMetres(
          pos.coords.latitude, pos.coords.longitude,
          event.venue_lat!, event.venue_lng!,
        );
        const radius = event.geo_radius_m ?? 300;
        setStaffGeo({ status: dist <= radius ? "ok" : "far", distanceM: Math.round(dist), radiusM: radius, venueName: event.venue });
        if (dist > radius) {
          setResult({
            valid: false,
            message: "Staff not at venue",
            detail: `You are ${Math.round(dist)}m away. Must be within ${radius}m of ${event.venue}.`,
          });
          return;
        }
      }

      // â”€â”€ 6. Mark ticket as used â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      ticketDB.markUsed(ticket.id);
      toast({ title: "âœ… Check-in successful", description: `${ticket.events?.name} Â· ${ticket.ticket_tiers?.tier_name}` });
      setResult({
        valid: true,
        message: "Ticket Verified!",
        detail: `${ticket.ticket_tiers?.tier_name} tier Â· Wallet ${ticket.owner_wallet.slice(0, 6)}â€¦${ticket.owner_wallet.slice(-4)}`,
        ticket,
        eventName: ticket.events?.name,
        venueName: ticket.events?.venue,
      });
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
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold mb-2 text-center">Check-in Verification</h1>
        <p className="text-muted-foreground mb-8 text-center">Scan or paste ticket QR code data</p>

        <div className="glass rounded-2xl p-8 space-y-6">
          {/* Icon + security badges */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-12 w-12 text-primary" />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.06] gap-1">
                <ShieldCheck className="h-2.5 w-2.5" /> HMAC-SHA256 Verified
              </Badge>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/[0.06] gap-1">
                <Clock className="h-2.5 w-2.5" /> 30-second window
              </Badge>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/[0.06] gap-1">
                <MapPin className="h-2.5 w-2.5" /> Geo-verified
              </Badge>
            </div>
          </div>

          {/* Staff geo status (shown after a geo-lock event is scanned) */}
          {staffGeo.status !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-sm ${
                staffGeo.status === "ok"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : staffGeo.status === "far"
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <Navigation2 className="h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold">
                    {staffGeo.status === "ok" && `At venue Â· ${staffGeo.distanceM}m away`}
                    {staffGeo.status === "far" && `Too far Â· ${staffGeo.distanceM}m (max ${staffGeo.radiusM}m)`}
                    {staffGeo.status === "checking" && "Checking your locationâ€¦"}
                    {staffGeo.status === "error" && staffGeo.message}
                  </p>
                  {"venueName" in staffGeo && (
                    <p className="text-xs opacity-70">{staffGeo.venueName}</p>
                  )}
                </div>
              </div>
              {(staffGeo.status === "far" || staffGeo.status === "error") && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-shrink-0" onClick={() => checkStaffLocation()}>
                  <Navigation className="h-3 w-3" /> Retry
                </Button>
              )}
            </motion.div>
          )}

          <div className="space-y-3">
            <Input
              placeholder="Paste QR data (dynamic JSON format)"
              value={qrInput}
              onChange={(e) => { setQrInput(e.target.value); setResult(null); }}
              className="font-mono text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            <Button
              className="w-full gradient-primary hover:opacity-90"
              onClick={handleVerify}
              disabled={checking || !qrInput.trim()}
            >
              {checking ? "Verifyingâ€¦" : "Verify Ticket"}
            </Button>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl p-6 text-center ${
                result.valid
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-destructive/10 border border-destructive/30"
              }`}
            >
              {result.valid ? (
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              )}
              <p className="font-semibold text-lg mb-1">{result.message}</p>
              {result.detail && (
                <p className="text-sm text-muted-foreground mb-3">{result.detail}</p>
              )}
              {(result.eventName || result.venueName) && (
                <div className="text-sm text-muted-foreground space-y-1 mt-3 pt-3 border-t border-white/10">
                  {result.eventName && <p className="font-medium text-foreground">{result.eventName}</p>}
                  {result.venueName && <p>{result.venueName}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* Format hint */}
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Format: {"{"}"ticketId", "window", "token"{"}"} Â· Press Enter to verify
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default CheckIn;
