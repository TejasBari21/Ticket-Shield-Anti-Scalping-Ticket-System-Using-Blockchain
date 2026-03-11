import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ShieldCheck, Clock, MapPin, Navigation, Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { useDynamicQR, QR_WINDOW_MS } from "@/hooks/useDynamicQR";
import { haversineMetres } from "@/lib/utils";

interface DynamicQRDisplayProps {
  ticketId: string;
  qrSecret: string | null;
  /** Pass true only while the dialog/panel is visible */
  active: boolean;
  size?: number;
  /** Venue coordinates for geo-lock (optional — skipped when not provided) */
  venueLat?: number;
  venueLng?: number;
  geoRadiusM?: number;
}

type GeoState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "allowed"; distanceM: number }
  | { status: "blocked"; distanceM: number }
  | { status: "error"; message: string };

/** Circular SVG progress ring drawn around the QR code */
function CountdownRing({
  progress,
  secondsLeft,
  size,
}: {
  progress: number;
  secondsLeft: number;
  size: number;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Ring depletes clockwise (progress 0→1 means elapsed 0→full)
  const dashOffset = circumference * (1 - progress);

  // Colour shifts from green → amber → red as the window expires
  let ringColor = "#22c55e"; // green
  if (secondsLeft <= 10) ringColor = "#ef4444"; // red
  else if (secondsLeft <= 15) ringColor = "#f59e0b"; // amber

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      {/* Active arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.4s ease" }}
      />
    </svg>
  );
}

const DynamicQRDisplay = ({
  ticketId,
  qrSecret,
  active,
  size = 220,
  venueLat,
  venueLng,
  geoRadiusM = 300,
}: DynamicQRDisplayProps) => {
  const { qrValue, secondsLeft, progress, ready } = useDynamicQR(ticketId, qrSecret, active);
  const prevWindow = useRef<number | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  const hasGeoLock = venueLat !== undefined && venueLng !== undefined;

  const checkGeo = useCallback(() => {
    if (!hasGeoLock) return;
    if (!navigator.geolocation) {
      setGeo({ status: "error", message: "Geolocation not supported by this browser" });
      return;
    }
    setGeo({ status: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineMetres(pos.coords.latitude, pos.coords.longitude, venueLat!, venueLng!);
        if (dist <= geoRadiusM) {
          setGeo({ status: "allowed", distanceM: Math.round(dist) });
        } else {
          setGeo({ status: "blocked", distanceM: Math.round(dist) });
        }
      },
      (err) => setGeo({ status: "error", message: err.message }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [hasGeoLock, venueLat, venueLng, geoRadiusM]);

  // Auto-check when dialog opens (if geo-lock is configured)
  useEffect(() => {
    if (active && hasGeoLock && geo.status === "idle") {
      checkGeo();
    }
    // Reset when closed
    if (!active) setGeo({ status: "idle" });
  }, [active, hasGeoLock, geo.status, checkGeo]);

  // Detect window rotation for the flash animation key
  const currentWindow = Math.floor(Date.now() / QR_WINDOW_MS);
  if (prevWindow.current === null) prevWindow.current = currentWindow;
  const isNewWindow = currentWindow !== prevWindow.current;
  if (isNewWindow) prevWindow.current = currentWindow;

  // The extra 24px is for the ring stroke + padding
  const containerSize = size + 24;

  // Geo is blocking if lock is configured and status is not "allowed"
  const geoBlocked = hasGeoLock && geo.status !== "allowed";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Dynamic Secure QR</span>
        </div>
        {hasGeoLock && (
          <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
            geo.status === "allowed"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : geo.status === "blocked"
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
          }`}>
            <MapPin className="h-3 w-3" />
            {geo.status === "allowed" && `Geo-verified · ${geo.distanceM}m away`}
            {geo.status === "blocked" && `Too far · ${geo.distanceM}m away`}
            {geo.status === "checking" && "Checking location…"}
            {geo.status === "idle" && "Geo-lock active"}
            {geo.status === "error" && "Location error"}
          </div>
        )}
      </div>

      {/* QR + ring wrapper */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        <CountdownRing progress={geoBlocked ? 0 : progress} secondsLeft={geoBlocked ? 0 : secondsLeft} size={containerSize} />

        {/* QR area */}
        <div className="bg-white rounded-xl p-3 shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {geoBlocked ? (
              /* Geo-lock overlay */
              <motion.div
                key="geoblocked"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center bg-gray-100"
                style={{ width: size, height: size }}
              >
                <Lock className="h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500 text-xs font-semibold text-center px-4">
                  {geo.status === "checking" ? "Verifying location…" :
                   geo.status === "blocked" ? `${geo.distanceM}m from venue\n(max ${geoRadiusM}m)` :
                   geo.status === "error" ? geo.message :
                   "Location required"}
                </p>
              </motion.div>
            ) : ready && qrValue ? (
              <motion.div
                key={currentWindow}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.25 }}
              >
                <QRCodeSVG value={qrValue} size={size} level="M" />
              </motion.div>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Geo-lock blocked: retry button + distance info */}
      {hasGeoLock && geo.status === "blocked" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-red-400 max-w-[240px]">
            You are <strong>{geo.distanceM}m</strong> from the venue. Move within <strong>{geoRadiusM}m</strong> to unlock your ticket.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={checkGeo}>
            <Navigation className="h-3 w-3" /> Retry Location
          </Button>
        </div>
      )}

      {hasGeoLock && geo.status === "error" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-yellow-400 max-w-[240px]">{geo.message}</p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={checkGeo}>
            <Navigation className="h-3 w-3" /> Retry Location
          </Button>
        </div>
      )}

      {/* Countdown + refresh label (only shown when QR is visible) */}
      {!geoBlocked && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Refreshes in{" "}
              <span
                className={`font-bold tabular-nums ${
                  secondsLeft <= 10
                    ? "text-destructive"
                    : secondsLeft <= 15
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {secondsLeft}s
              </span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground/60 text-center max-w-[220px]">
            QR code rotates every 30 s — screenshots are invalid
          </p>
        </div>
      )}

      {/* Security badge row */}
      <div className="flex gap-2 flex-wrap justify-center">
        {["HMAC-SHA256", "30-sec window", "Screenshot-proof", ...(hasGeoLock ? ["Geo-locked"] : [])].map((label) => (
          <span
            key={label}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              label === "Geo-locked"
                ? "border-blue-500/30 bg-blue-500/[0.07] text-blue-400"
                : "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DynamicQRDisplay;
