import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, CheckCircle, XCircle, ShieldCheck, Clock, ArrowLeft, MapPin, Navigation, Navigation2, Camera, CameraOff } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { verifyQRToken, QR_WINDOW_MS, type DynamicQRPayload } from "@/hooks/useDynamicQR";
import { ticketDB, localDB } from "@/lib/localDB";
import { haversineMetres } from "@/lib/utils";
import jsQR from "jsqr";

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

type CameraDevice = { id: string; label: string };

const CheckIn = () => {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const scanningRef = useRef(false);
  const frameRequestRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ value: string; ts: number }>({ value: "", ts: 0 });
  const [qrInput, setQrInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [staffGeo, setStaffGeo] = useState<StaffGeo>({ status: "idle" });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerMode, setScannerMode] = useState<"barcode" | "jsqr" | null>(null);
  const [hasVideoSignal, setHasVideoSignal] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [imageScanning, setImageScanning] = useState(false);
  const [scannerSupported, setScannerSupported] = useState<boolean>(() => {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  });

  const stopCamera = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
    setScannerMode(null);
    setHasVideoSignal(false);
    setCameraActive(false);
  }, []);

  const loadCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          id: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setCameraDevices(cams);
      if (!selectedCameraId && cams.length > 0) {
        setSelectedCameraId(cams[0].id);
      }
    } catch {
      setCameraDevices([]);
    }
  }, [selectedCameraId]);

  const openCameraStream = useCallback(async (preferredDeviceId?: string): Promise<MediaStream> => {
    const attempts: MediaStreamConstraints[] = [];

    if (preferredDeviceId) {
      attempts.push({ video: { deviceId: { exact: preferredDeviceId } }, audio: false });
    }

    attempts.push(
      { video: { facingMode: { exact: "environment" } }, audio: false },
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: true, audio: false },
    );

    let lastError: unknown = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const liveTrack = stream.getVideoTracks()[0];
        if (liveTrack?.readyState === "live") {
          return stream;
        }
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Unable to open camera stream");
  }, []);

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

  const verifyPayload = useCallback(async (rawPayload: string) => {
    if (!rawPayload.trim()) return;
    setChecking(true);
    setResult(null);
    setStaffGeo({ status: "idle" });

    try {
      // 1. Parse QR payload
      let parsed: Partial<DynamicQRPayload> & { secret?: string };
      try {
        parsed = JSON.parse(rawPayload.trim());
      } catch {
        setResult({ valid: false, message: "Invalid QR format", detail: "Could not parse JSON payload." });
        return;
      }

      if (!parsed.ticketId) {
        setResult({ valid: false, message: "Verification Failed", detail: "Missing ticketId in QR payload" });
        return;
      }

      // 2. Look up ticket
      const ticket = ticketDB.getTicketById(parsed.ticketId);
      if (!ticket) {
        setResult({ valid: false, message: "Ticket not found", detail: "This ticket ID does not exist in the ledger." });
        return;
      }

      // 3. Already used?
      if (ticket.status === "used") {
        setResult({
          valid: false,
          message: "Ticket Already Scanned",
          detail: "This ticket was already checked in. Fraud attempt logged.",
          ticket,
          eventName: ticket.events?.name,
          venueName: ticket.events?.venue,
        });
        return;
      }

      // 4. Verify HMAC token
      const nowWindow = Math.floor(Date.now() / QR_WINDOW_MS);
      const windowToCheck = typeof parsed.window === "number" ? parsed.window : nowWindow;

      if (parsed.token) {
        // Dynamic QR: verify HMAC
        const valid = await verifyQRToken(ticket.qr_secret, windowToCheck, parsed.token);
        if (!valid) {
          setResult({ valid: false, message: "Token Expired", detail: "HMAC verification failed. Please refresh the QR code." });
          return;
        }
      } else {
        // No token present — reject
        setResult({ valid: false, message: "Missing Security Token", detail: "QR code is missing cryptographic token." });
        return;
      }

      // 5. Check geo-lock (if event has coordinates)
      const event = localDB.getEvent(ticket.event_id);
      if (event?.venue_lat && event?.venue_lng) {
        if (!navigator.geolocation) {
          setResult({ valid: false, message: "Geo-lock Active", detail: "Location services are required to verify this ticket." });
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

      // 6. Mark ticket as used
      ticketDB.markUsed(ticket.id);
      setResult({
        valid: true,
        message: "Ticket Verified!",
        detail: `${ticket.ticket_tiers?.tier_name} tier • Wallet ${ticket.owner_wallet.slice(0, 6)}…${ticket.owner_wallet.slice(-4)}`,
        ticket,
        eventName: ticket.events?.name,
        venueName: ticket.events?.venue,
      });
    } catch (err: any) {
      setResult({ valid: false, message: err.message || "Verification failed" });
    } finally {
      setChecking(false);
    }
  }, []);

  const scanFrame = useCallback(async () => {
    if (!cameraActive || !videoRef.current || !scannerMode || scanningRef.current) {
      return;
    }

    scanningRef.current = true;
    try {
      const video = videoRef.current;
      let rawValue = "";
      setHasVideoSignal(video.videoWidth > 0 && video.videoHeight > 0);

      if (video.readyState >= 2) {
        if (scannerMode === "barcode" && detectorRef.current) {
          const codes = await detectorRef.current.detect(video);
          if (Array.isArray(codes) && codes.length > 0) {
            rawValue = String(codes[0]?.rawValue ?? "").trim();
          }
        } else if (scannerMode === "jsqr" && canvasRef.current) {
          const canvas = canvasRef.current;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              rawValue = String(decoded?.data ?? "").trim();
            }
          }
        }

        const now = Date.now();
        if (
          rawValue &&
          !(lastScannedRef.current.value === rawValue && now - lastScannedRef.current.ts < 5000)
        ) {
          lastScannedRef.current = { value: rawValue, ts: now };
          setQrInput(rawValue);
          stopCamera();
          toast({
            title: "QR captured",
            description: "Payload scanned from camera. Running verification...",
          });
          await verifyPayload(rawValue);
          return;
        }
      }
    } catch (err: any) {
      setCameraError(err?.message || "Camera scan failed");
    } finally {
      scanningRef.current = false;
    }

    frameRequestRef.current = requestAnimationFrame(() => {
      void scanFrame();
    });
  }, [cameraActive, scannerMode, stopCamera, toast, verifyPayload]);

  const startCamera = useCallback(async (preferredDeviceId?: string) => {
    if (checking) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerSupported(false);
      setCameraError("Camera is not supported in this browser.");
      return;
    }

    try {
      setCameraError(null);
      if ("BarcodeDetector" in window) {
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        detectorRef.current = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        setScannerMode("barcode");
      } else {
        detectorRef.current = null;
        setScannerMode("jsqr");
      }

      const stream = await openCameraStream(preferredDeviceId || selectedCameraId || undefined);

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await loadCameraDevices();

      setCameraActive(true);
    } catch (err: any) {
      stopCamera();
      setCameraError(err?.message || "Unable to access camera");
    }
  }, [checking, loadCameraDevices, openCameraStream, selectedCameraId, stopCamera]);

  const switchCamera = useCallback(async () => {
    if (cameraDevices.length === 0) return;
    const idx = cameraDevices.findIndex((c) => c.id === selectedCameraId);
    const next = cameraDevices[(idx + 1) % cameraDevices.length];
    if (!next) return;
    setSelectedCameraId(next.id);
    stopCamera();
    await startCamera(next.id);
  }, [cameraDevices, selectedCameraId, startCamera, stopCamera]);

  const handleImageScan = useCallback(async (file: File) => {
    setImageScanning(true);
    setCameraError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Unable to process selected image");
      }

      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let rawValue = "";
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (decoded?.data) {
        rawValue = decoded.data.trim();
      }

      if (!rawValue && "BarcodeDetector" in window) {
        try {
          const BarcodeDetectorCtor = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
          const codes = await detector.detect(canvas);
          if (Array.isArray(codes) && codes.length > 0) {
            rawValue = String(codes[0]?.rawValue ?? "").trim();
          }
        } catch {
          // Ignore detector errors and keep jsQR result path.
        }
      }

      if (!rawValue) {
        setCameraError("No QR found in selected image.");
        return;
      }

      setQrInput(rawValue);
      toast({ title: "QR loaded", description: "Image decoded. Running verification..." });
      await verifyPayload(rawValue);
    } catch (err: any) {
      setCameraError(err?.message || "Image scan failed");
    } finally {
      setImageScanning(false);
    }
  }, [toast, verifyPayload]);

  const handleVerify = async () => {
    await verifyPayload(qrInput);
  };

  useEffect(() => {
    if (cameraActive) {
      frameRequestRef.current = requestAnimationFrame(() => {
        void scanFrame();
      });

      const timeoutId = window.setTimeout(() => {
        const video = videoRef.current;
        if (video && video.videoWidth === 0) {
          setCameraError("No camera video signal. Check camera permissions or switch camera.");
        }
      }, 2500);

      return () => {
        window.clearTimeout(timeoutId);
        if (frameRequestRef.current) {
          cancelAnimationFrame(frameRequestRef.current);
          frameRequestRef.current = null;
        }
      };
    }

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
    };
  }, [cameraActive, scanFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void loadCameraDevices();
  }, [loadCameraDevices]);

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 bg-background min-h-screen flex flex-col items-center justify-center">
        <ScanLine className="h-16 w-16 text-[#9CA3AF]/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#1F2933]">Connect Wallet</h2>
        <p className="text-[#6B7280] border border-[#E5E7EB] rounded-xl px-4 py-2 mt-4 inline-block bg-white shadow-sm">Staff access required for check-in.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex flex-col min-h-[calc(100vh-64px)] overflow-hidden font-body bg-background selection:bg-[#1BA6A6]/10 text-foreground">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#1BA6A6]/5 blur-[150px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#7ED4D4]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 p-6 flex flex-col h-full max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-[#6B7280] hover:text-[#1F2933] px-2 py-1 h-auto bg-transparent hover:bg-black/5 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <h1 className="text-xl font-headline font-extrabold tracking-tight text-[#1F2933]">Scanner Console</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Not Scanned State */}
        {!result && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-10">
            {/* Scanning Overlay */}
            <div className="relative w-full max-w-[280px] aspect-square mb-10">
              {/* Teal Scanning Frame Corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-[#1BA6A6] rounded-tl-xl transition-all duration-[2s]"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-[#1BA6A6] rounded-tr-xl transition-all duration-[2s]"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-[#1BA6A6] rounded-bl-xl transition-all duration-[2s]"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-[#1BA6A6] rounded-br-xl transition-all duration-[2s]"></div>
              
              {/* Inner Scanning Area */}
              <div className="absolute inset-4 overflow-hidden rounded-xl bg-white shadow-inner border border-[#E5E7EB]/50">
                {checking && <div className="absolute left-0 right-0 h-0.5 bg-[#1BA6A6] shadow-[0_0_15px_2px_rgba(27,166,166,0.5)] animate-[scan_2s_ease-in-out_infinite]" />}
              </div>
              
              {/* Ghost QR Background */}
              <div className="absolute inset-8 opacity-10 flex items-center justify-center pointer-events-none">
                <ScanLine className="w-32 h-32 text-[#1BA6A6] stroke-[1]" />
              </div>
            </div>

            <div className="text-center space-y-2 mb-10">
              <p className="text-[#1F2933] font-headline font-bold text-xl tracking-wide">{checking ? "De-crypting Asset..." : "Ready to Verify"}</p>
              <p className="text-[#6B7280] font-label text-[10px] uppercase tracking-[0.2em] font-bold">Align QR within protocol grid</p>
            </div>

            {/* Input Area */}
            <div className="w-full space-y-4">
              <div className="p-4 rounded-2xl border border-[#E5E7EB] flex items-center gap-4 bg-white shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#1BA6A6]/10 flex items-center justify-center text-[#1BA6A6]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-[#1F2933]">Real-time Verification Active</h4>
                  <p className="text-[10px] text-[#6B7280] font-medium mt-0.5">Tickets are cross-referenced with the verified ledger.</p>
                </div>
              </div>

               {/* Staff geo status */}
              {staffGeo.status !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-sm shadow-sm ${
                    staffGeo.status === "ok"
                      ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                      : staffGeo.status === "far"
                      ? "bg-red-50 border border-red-100 text-red-700"
                      : "bg-amber-50 border border-amber-100 text-amber-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Navigation2 className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-tight">
                        {staffGeo.status === "ok" && `Verified Venue: ${staffGeo.distanceM}m`}
                        {staffGeo.status === "far" && `Out of Bounds: ${staffGeo.distanceM}m`}
                        {staffGeo.status === "checking" && "Locating Protocol…"}
                        {staffGeo.status === "error" && staffGeo.message}
                      </p>
                      {"venueName" in staffGeo && (
                        <p className="text-[10px] font-medium opacity-80 mt-0.5">{staffGeo.venueName}</p>
                      )}
                    </div>
                  </div>
                  {(staffGeo.status === "far" || staffGeo.status === "error") && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase tracking-widest gap-1 flex-shrink-0 hover:bg-black/5" onClick={() => checkStaffLocation()}>
                      <Navigation className="h-3 w-3" /> Retry
                    </Button>
                  )}
                </motion.div>
              )}

              <div className="relative group">
                <Input
                  placeholder="Paste QR Protocol Payload"
                  value={qrInput}
                  onChange={(e) => { setQrInput(e.target.value); setResult(null); }}
                  className="font-mono text-xs h-14 bg-white border border-[#E5E7EB] rounded-2xl pl-4 pr-24 text-[#1F2933] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#1BA6A6]/10 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
                <Button
                  size="sm"
                  className="absolute right-2 top-2 bottom-2 bg-[#1BA6A6] hover:opacity-90 text-white border-none font-bold tracking-widest text-[10px] uppercase rounded-xl shadow-lg shadow-[#1BA6A6]/20 transition-all px-4"
                  onClick={handleVerify}
                  disabled={checking || !qrInput.trim()}
                >
                  Verify
                </Button>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F2933]">Camera Scanner Module</h4>
                    <p className="text-[10px] text-[#6B7280] font-medium mt-0.5">
                      Scan QR directly to auto-fill and verify ticket payload.
                    </p>
                  </div>
                  {cameraActive ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Live</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">Idle</Badge>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-black/90 relative aspect-video">
                  {cameraActive ? (
                    <>
                      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-6 border-2 border-[#1BA6A6]/80 rounded-xl" />
                        <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-[#1BA6A6] opacity-80 animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                      {!hasVideoSignal && (
                        <div className="absolute inset-0 flex items-center justify-center text-center px-4 bg-black/50">
                          <p className="text-xs text-white/90 font-semibold">
                            Waiting for camera signal...
                          </p>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-semibold uppercase tracking-widest">
                        {scannerMode === "barcode" ? "Native Scan" : "Fallback Scan"}
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-center px-6">
                      <p className="text-xs text-white/80 font-medium">
                        {scannerSupported
                          ? "Camera preview appears here once scanner starts."
                          : "Browser does not support camera scanning. Use paste verification instead."}
                      </p>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {cameraError}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {cameraDevices.length > 0 && (
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="h-10 rounded-xl border border-[#E5E7EB] px-3 text-xs font-semibold text-[#1F2933] bg-white"
                    >
                      {cameraDevices.map((cam) => (
                        <option key={cam.id} value={cam.id}>{cam.label}</option>
                      ))}
                    </select>
                  )}

                  {!cameraActive ? (
                    <Button
                      type="button"
                      onClick={() => void startCamera()}
                      disabled={checking || !scannerSupported}
                      className="h-10 rounded-xl bg-[#1BA6A6] hover:opacity-90 text-white border-none font-bold text-xs uppercase tracking-widest gap-2"
                    >
                      <Camera className="h-4 w-4" /> Start Camera
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        onClick={() => void switchCamera()}
                        variant="outline"
                        className="h-10 rounded-xl border-[#E5E7EB] text-[#1F2933] font-bold text-xs uppercase tracking-widest gap-2"
                      >
                        <Camera className="h-4 w-4" /> Switch Camera
                      </Button>
                      <Button
                        type="button"
                        onClick={stopCamera}
                        variant="outline"
                        className="h-10 rounded-xl border-[#E5E7EB] text-[#1F2933] font-bold text-xs uppercase tracking-widest gap-2"
                      >
                        <CameraOff className="h-4 w-4" /> Stop Camera
                      </Button>
                    </>
                  )}

                  <label className="h-10 rounded-xl border border-[#E5E7EB] text-[#1F2933] font-bold text-xs uppercase tracking-widest px-4 inline-flex items-center gap-2 cursor-pointer bg-white hover:bg-slate-50">
                    <ScanLine className="h-4 w-4" /> {imageScanning ? "Reading..." : "Scan Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageScanning || checking}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (file) {
                          void handleImageScan(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanned Result State */}
        {result && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <div className="mb-8 text-center">
              <div className="relative inline-block mb-6">
                 {/* Status Ring */}
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center ${result.valid ? 'border-emerald-100 bg-white' : 'border-red-100 bg-white shadow-sm'}`}>
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${result.valid ? 'bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-red-500/10 text-red-500 shadow-lg shadow-red-500/10'}`}>
                    {result.valid ? <ShieldCheck className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className={`font-label text-[10px] uppercase tracking-[0.2em] font-bold ${result.valid ? 'text-[#1BA6A6]' : 'text-red-500'}`}>
                  {result.valid ? "Protocol Verification Success" : "Protocol Verification Failed"}
                </p>
                <h2 className="font-headline font-extrabold text-4xl text-[#1F2933] mt-2 tracking-tight">
                  {result.valid ? "Ticket Verified" : "Access Denied"}
                </h2>
              </div>
            </div>

            {/* Sub-Message */}
            {!result.valid && (
              <div className="mb-8 bg-red-50 border border-red-100 px-6 py-5 rounded-2xl text-center max-w-sm w-full shadow-md">
                <p className="font-bold text-red-600 text-sm mb-1">{result.message}</p>
                {result.detail && <p className="text-[11px] text-[#6B7280] font-semibold leading-relaxed">{result.detail}</p>}
              </div>
            )}

            {/* Ticket Card Details */}
            {result.ticket && (
              <div className="w-full bg-white rounded-3xl overflow-hidden relative shadow-2xl border border-[#E5E7EB] mb-8 max-w-sm">
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent ${result.valid ? 'via-[#1BA6A6]' : 'via-red-500'} to-transparent opacity-40`}></div>
                <div className="p-8">
                  {/* Event Metadata */}
                  <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1.5 pr-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${result.valid ? 'bg-[#1BA6A6]/10 text-[#1BA6A6]' : 'bg-red-50 text-red-500'}`}>
                        {result.ticket.ticket_tiers?.tier_name || "Admission"}
                      </span>
                      <h3 className="font-headline font-bold text-2xl text-[#1F2933] leading-tight mt-3 truncate max-w-[220px]">
                        {result.eventName || "Unknown Event"}
                      </h3>
                      <p className="text-xs text-[#6B7280] truncate flex items-center gap-1.5 mt-1 max-w-[220px] font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" /> {result.venueName || "Unknown Venue"}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                    <div className="flex flex-col">
                      <label className="font-label text-[9px] uppercase tracking-widest text-[#9CA3AF] mb-1 font-bold">Protocol ID</label>
                      <p className="font-mono font-bold text-[#1F2933] text-xs truncate max-w-[130px]" title={result.ticket.id}>
                        {result.ticket.id.toUpperCase().slice(0, 14)}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <label className="font-label text-[9px] uppercase tracking-widest text-[#9CA3AF] mb-1 font-bold">Ledger Status</label>
                      <p className={`font-body font-bold uppercase text-[10px] tracking-wide ${result.valid ? 'text-emerald-600' : 'text-red-600'}`}>{result.ticket.status}</p>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <label className="font-label text-[9px] uppercase tracking-widest text-[#9CA3AF] mb-1 font-bold">Verified Owner Wallet</label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-[#1BA6A6] text-[11px] truncate max-w-[260px]">
                          {result.ticket.owner_wallet}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Footer Brand */}
                <div className="bg-[#F5F7F8] px-8 py-3.5 flex justify-between items-center border-t border-[#E5E7EB]">
                  <span className="font-label text-[9px] text-[#9CA3AF] uppercase tracking-widest font-black">TicketShield Ledger v2.0</span>
                  <div className="flex gap-1.5 border border-[#1BA6A6]/20 rounded-full px-2.5 py-1 bg-[#1BA6A6]/5">
                    <ShieldCheck className="w-3 h-3 text-[#1BA6A6]" />
                    <span className="text-[8px] font-bold text-[#1BA6A6] uppercase tracking-widest">Secured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Area */}
            <div className="w-full max-w-sm flex flex-col gap-4 border-t border-[#E5E7EB] pt-8">
              <Button 
                onClick={() => { setQrInput(""); setResult(null); }}
                className="w-full h-14 rounded-2xl font-headline font-extrabold text-white bg-[#1BA6A6] shadow-xl shadow-[#1BA6A6]/20 border-none transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-sm"
              >
                Scan Next Individual
              </Button>
            </div>
            
            <p className="mt-8 font-label text-[9px] text-[#9CA3AF] uppercase tracking-widest text-center max-w-[280px] font-bold">
              Ledger verified at: {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {/* Required style overrides inline */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CheckIn;

