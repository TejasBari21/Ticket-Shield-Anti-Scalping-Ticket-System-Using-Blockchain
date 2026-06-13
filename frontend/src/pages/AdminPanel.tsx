import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield, Users, Ticket, Calendar, Activity, Plus, Trash2,
  ScanLine, CheckCircle, XCircle, Search, Edit, UserCheck, ArrowLeft,
  TrendingUp, DollarSign, BarChart2, AlertTriangle, Download,
  RefreshCw, Eye, Ban, Filter, ChevronDown, ChevronUp, FileText, Zap,
} from "lucide-react";
import {
  Badge, Button, Input, Textarea, Label, Switch,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  Progress,
} from "@/components/ui";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { localDB, LocalEvent, LocalTier, LocalTicket, ArchivedEventRecord } from "@/lib/localDB";
import { ticketDB, auditLogDB, AuditEntry } from "@/lib/localDB";
import { db, KYCSubmission as MongoDBKYCSubmission } from "@/integrations/mongodb/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useNavigate } from "react-router-dom";
import { format, subDays, parseISO, startOfDay } from "date-fns";
import { useTransactionMonitor } from "@/hooks/useTransactionMonitor";
import { TransactionFeed } from "@/components/TransactionFeed";
import { createEvent as createEventOnChain, initializeContract } from "@/integrations/contracts/contractService";
import { verifyQRToken, QR_WINDOW_MS, type DynamicQRPayload } from "@/hooks/useDynamicQR";

const CONTRACT_ADDRESS = (import.meta.env as Record<string, string>).VITE_CONTRACT_ADDRESS;

interface TierForm {
  tier_name: string;
  price: string;
  total_supply: string;
  max_per_wallet: string;
}

interface TierEditForm {
  id: string;
  price: string;
  total_supply: string;
}

interface KycSubmission {
  id: string;
  full_name: string;
  wallet_address: string;
  country: string;
  id_type: string;
  status: "pending" | "rejected" | "approved" | "unverified";
  submitted_at: string;
}

interface VerificationResult {
  valid: boolean;
  message: string;
  ticket?: LocalTicket;
  event?: LocalEvent;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  ticket_purchased: "#22c55e",
  check_in: "#06b6d4",
  user_registration: "#8b5cf6",
  wallet_connected: "#6366f1",
  kyc_submitted: "#f59e0b",
  kyc_approved: "#10b981",
  kyc_rejected: "#ef4444",
  event_created: "#3b82f6",
  ticket_resale: "#f97316",
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#f97316", "#8b5cf6"];

interface DailyPoint { date: string; tickets: number; revenue: number; checkins: number; }

function buildDailySeries(
  tickets: ReturnType<typeof ticketDB.getAllTickets>,
  audit: AuditEntry[],
  days = 14,
): DailyPoint[] {
  const map: Record<string, DailyPoint> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "MMM d");
    map[d] = { date: d, tickets: 0, revenue: 0, checkins: 0 };
  }
  for (const t of tickets) {
    const d = format(parseISO(t.created_at), "MMM d");
    if (map[d]) {
      map[d].tickets += 1;
      map[d].revenue += t.ticket_tiers?.price ?? 0;
    }
  }
  for (const a of audit) {
    if (a.action !== "check_in") continue;
    const d = format(parseISO(a.timestamp), "MMM d");
    if (map[d]) map[d].checkins += 1;
  }
  return Object.values(map);
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: number; // positive = green, negative = red
}

function StatCard({ icon: Icon, label, value, sub, color, trend }: StatCardProps) {
  return (
    <div className="relative bg-white rounded-[1.5rem] p-6 flex flex-col gap-4 border border-[#E5E7EB] hover:border-[#1BA6A6]/30 hover:shadow-lg transition-all duration-300 group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1BA6A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between">
        <div className="h-12 w-12 rounded-[1rem] flex items-center justify-center bg-[#F5F7F8] border border-[#E5E7EB] shadow-sm group-hover:scale-110 transition-transform duration-500" style={{ color }}>
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md bg-[#F5F7F8] shadow-sm border border-[#E5E7EB] ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {trend >= 0 ? <ChevronUp className="h-3 w-3 stroke-[3]" /> : <ChevronDown className="h-3 w-3 stroke-[3]" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-extrabold tracking-tight text-[#1F2933]">{value}</p>
        <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mt-1">{label}</p>
        {sub && <p className="text-[11px] font-medium text-[#9CA3AF] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mb-4">{children}</h3>;
}

const AdminPanel = () => {
  const { isConnected, hasRole, userId, address } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Live blockchain transaction monitor
  const contractAddress = (import.meta as { env: Record<string, string> }).env.VITE_CONTRACT_ADDRESS;
  const { transactions: liveTxs, isListening, error: monitorError, clearTransactions } =
    useTransactionMonitor(contractAddress);

  const [stats, setStats] = useState({ events: 0, tickets: 0, users: 0, revenue: 0 });
  const [profiles, setProfiles] = useState<Array<{ id: string; email: string }>>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<ArchivedEventRecord[]>([]);
  const [allTickets, setAllTickets] = useState<ReturnType<typeof ticketDB.getAllTickets>>([]);
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmission[]>([]);

  // Analytics view range
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(14);

  // Event management — edit dialog state
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    name: "", description: "", venue: "", location: "", status: "published",
  });

  // Fraud monitoring
  const [fraudFilter, setFraudFilter] = useState<"all" | "resale" | "blocked">("all");

  // User detail expand
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Create Event state
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: "", description: "", date: "", end_date: "", venue: "", location: "",
    image_url: "", category: "general", resale_enabled: true, resale_price_cap_percent: "100",
  });
  const [tiers, setTiers] = useState<TierForm[]>([
    { tier_name: "General Admission", price: "0.01", total_supply: "100", max_per_wallet: "4" },
  ]);

  // Ticket tiers management
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventTiers, setEventTiers] = useState<LocalTier[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<TierEditForm | null>(null);

  // Per-event on-chain registration loading state
  const [registeringChain, setRegisteringChain] = useState<Record<string, boolean>>({});

  // Verify tickets
  const [qrInput, setQrInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);

  // Ticket search
  const [ticketSearch, setTicketSearch] = useState("");
  const [searchedTickets, setSearchedTickets] = useState<LocalTicket[]>([]);
  const [ticketSearching, setTicketSearching] = useState(false);

  const [loading, setLoading] = useState(true);

  const refreshAll = () => {
    // Events + stats
    console.debug("[AdminPanel.refreshAll] Loading events from localStorage");
    const evts = localDB.getEvents();
    console.debug("[AdminPanel.refreshAll] Loaded events:", { count: evts.length, events: evts.map(e => ({ id: e.id, name: e.name, status: e.status })) });
    setEvents(evts);
    setArchivedEvents(localDB.getArchivedEvents());
    const allTix = ticketDB.getAllTickets();
    setAllTickets(allTix);
    const totalSold = allTix.length;
    const revenue = allTix.reduce((sum, t) => sum + (t.ticket_tiers?.price ?? 0), 0);
    // Users — fetched asynchronously from MongoDB; stats update when the query resolves
    db.users.getAll().then((users) => {
      const mappedUsers = users.map(u => ({
        id: u._id || u.id || u.user_id || '',
        email: u.email,
      }));
      setProfiles(mappedUsers);
      setStats((prev) => ({ ...prev, users: mappedUsers.length }));
    });
    // Audit log
    setAuditEntries(auditLogDB.getAll());
    // KYC submissions — fetched from MongoDB
    db.kyc.getPending().then((kycData) => {
      const pendingKyc = (kycData ?? []).map((s: MongoDBKYCSubmission) => ({
        id: s._id || s.id || '',
        full_name: s.full_name,
        wallet_address: s.wallet_address,
        country: s.country,
        id_type: s.id_type,
        status: s.status,
        submitted_at: s.submitted_at,
      }));
      setKycSubmissions(pendingKyc as KycSubmission[]);
    }).catch((error) => {
      console.error('Failed to fetch KYC submissions:', error);
      setKycSubmissions([]);
    });
    setStats((prev) => ({ ...prev, events: evts.length, tickets: totalSold, revenue: Math.round(revenue * 10000) / 10000 }));
  };

  useEffect(() => {
    if (!userId) return;
    refreshAll();
    setLoading(false);
  }, [userId]);

  // Refresh on any localStorage change (purchases, registrations, check-ins, etc.)
  useEffect(() => {
    window.addEventListener("storage", refreshAll);
    return () => window.removeEventListener("storage", refreshAll);
  }, []);

  // Poll every 5 s so same-tab actions (audit log writes) also update the panel
  useEffect(() => {
    const id = setInterval(refreshAll, 5000);
    return () => clearInterval(id);
  }, []);

  const updateEventStatus = (eventId: string, status: string) => {
    localDB.updateEventStatus(eventId, status);
    toast({ title: `Event ${status}` });
    refreshAll();
  };

  // --- Register existing event on-chain ---
  const handleRegisterOnChain = async (event: LocalEvent) => {
    if (!address || !isConnected) {
      toast({ title: "Connect admin wallet", description: "Connect MetaMask with the admin wallet first.", variant: "destructive" });
      return;
    }
    setRegisteringChain((prev) => ({ ...prev, [event.id]: true }));
    try {
      await initializeContract(CONTRACT_ADDRESS, address);
      const basePrice = event.ticket_tiers[0]?.price?.toString() || "0";
      const totalCapacity = event.ticket_tiers.reduce((s, t) => s + t.total_supply, 0);
      const { contractEventId } = await createEventOnChain(
        event.name,
        event.description || "",
        new Date(event.date).getTime(),
        event.location || event.venue,
        totalCapacity,
        basePrice,
      );
      localDB.updateEvent(event.id, { contract_event_id: contractEventId });
      toast({ title: "Registered on Chain ✅", description: `contract_event_id = ${contractEventId}` });
      refreshAll();
    } catch (err) {
      toast({ title: "Registration Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setRegisteringChain((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  // --- Create Event ---
  const resetEventForm = () => {
    setEventForm({ name: "", description: "", date: "", end_date: "", venue: "", location: "", image_url: "", category: "general", resale_enabled: true, resale_price_cap_percent: "100" });
    setTiers([{ tier_name: "General Admission", price: "0.01", total_supply: "100", max_per_wallet: "4" }]);
  };

  const handleCreateEvent = async (status: "draft" | "published") => {
    console.debug("[AdminPanel.handleCreateEvent] Starting with status:", status);
    const normalizedName = eventForm.name.trim();
    const normalizedVenue = eventForm.venue.trim();
    const normalizedLocation = eventForm.location.trim() || normalizedVenue;

    if (!userId || !normalizedName || !eventForm.date || !normalizedVenue) {
      toast({ title: "Missing fields", description: "Fill in name, date, and venue.", variant: "destructive" });
      return;
    }

    const eventStartMs = new Date(eventForm.date).getTime();
    if (!Number.isFinite(eventStartMs) || eventStartMs <= Date.now() + 30_000) {
      toast({ title: "Invalid Date", description: "Event date must be at least 30 seconds in the future.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const tierData = tiers.filter(t => t.tier_name).map(t => ({
        tier_name: t.tier_name,
        price: parseFloat(t.price) || 0,
        total_supply: parseInt(t.total_supply) || 100,
        remaining_supply: parseInt(t.total_supply) || 100,
        max_per_wallet: parseInt(t.max_per_wallet) || 4,
      }));

      // Try to register the event on-chain so tickets can transfer real ETH
      let contract_event_id: number | undefined;
      if (address && isConnected) {
        console.debug("[AdminPanel.handleCreateEvent] Wallet connected, attempting on-chain registration", { address, isConnected });
        try {
          await initializeContract(CONTRACT_ADDRESS, address);
          const basePrice = tierData[0]?.price?.toString() || "0";
          const totalCapacity = tierData.reduce((s, t) => s + t.total_supply, 0);
          console.debug("[AdminPanel.handleCreateEvent] Calling createEventOnChain with:", { name: normalizedName, totalCapacity, basePrice });
          const { contractEventId } = await createEventOnChain(
            normalizedName,
            eventForm.description || "",
            eventStartMs,
            normalizedLocation,
            totalCapacity,
            basePrice,
          );
          contract_event_id = contractEventId;
          console.debug("[AdminPanel.handleCreateEvent] On-chain registration succeeded:", { contractEventId });
          toast({ title: "Event Registered On-Chain ✅", description: `Contract event ID: ${contractEventId}` });
        } catch (chainErr: unknown) {
          const msg = chainErr instanceof Error ? chainErr.message : "Failed to register event on-chain.";
          console.error("[AdminPanel.handleCreateEvent] On-chain registration failed:", msg);
          if (status === "published") {
            throw new Error(msg);
          }
          console.debug("[AdminPanel.handleCreateEvent] Continuing as draft despite error");
          toast({ title: "On-Chain Registration Skipped", description: msg, variant: "destructive" });
        }
      } else {
        console.debug("[AdminPanel.handleCreateEvent] Wallet not connected, skipping on-chain registration", { address, isConnected });
      }

      console.debug("[AdminPanel.handleCreateEvent] Creating event in local database with:", { 
        name: normalizedName, 
        contract_event_id,
        status,
        tierCount: tierData.length 
      });
      const createdEvent = localDB.createEvent(
        {
          organizer_id: userId,
          name: normalizedName,
          description: eventForm.description || null,
          date: new Date(eventForm.date).toISOString(),
          end_date: eventForm.end_date ? new Date(eventForm.end_date).toISOString() : null,
          venue: normalizedVenue,
          location: normalizedLocation,
          image_url: eventForm.image_url || null,
          category: eventForm.category,
          status,
          resale_enabled: eventForm.resale_enabled,
          resale_price_cap_percent: parseInt(eventForm.resale_price_cap_percent) || 100,
          contract_event_id,
        },
        tierData,
      );
      console.debug("[AdminPanel.handleCreateEvent] Event created in database:", { id: createdEvent.id, name: createdEvent.name });
      toast({ title: "Event Created! 🎉", description: status === "published" ? "Event is now live." : "Saved as draft." });
      auditLogDB.log({ action: "event_created", user_id: userId, detail: `${normalizedName} · ${status}` });
      
      console.debug("[AdminPanel.handleCreateEvent] Calling refreshAll()");
      setCreateOpen(false);
      resetEventForm();
      refreshAll();
      console.debug("[AdminPanel.handleCreateEvent] refreshAll() completed");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[AdminPanel.handleCreateEvent] Error:", errMsg);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => setTiers([...tiers, { tier_name: "", price: "0", total_supply: "50", max_per_wallet: "4" }]);
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof TierForm, value: string) => {
    const updated = [...tiers];
    updated[i][field] = value;
    setTiers(updated);
  };

  // --- Ticket Tiers Management ---
  const loadTiers = (eventId: string) => {
    setSelectedEventId(eventId);
    const evt = localDB.getEvent(eventId);
    setEventTiers(evt?.ticket_tiers || []);
    setTiersOpen(true);
  };

  const updateTierPrice = (_tierId: string, _price: number, _supply: number) => {
    toast({ title: "Tier editing", description: "Tier price editing requires database." });
    setEditingTier(null);
  };

  // --- Verify Ticket ---
  const handleVerify = async () => {
    if (!qrInput.trim()) return;
    setChecking(true);
    setVerifyResult(null);

    try {
      let parsed: Partial<DynamicQRPayload>;
      try {
        parsed = JSON.parse(qrInput);
      } catch {
        setVerifyResult({ valid: false, message: "Invalid QR code format" });
        return;
      }

      if (!parsed.ticketId) {
        setVerifyResult({ valid: false, message: "Missing ticket ID" });
        return;
      }

      const ticket = ticketDB.getTicketById(parsed.ticketId);
      if (!ticket) {
        setVerifyResult({ valid: false, message: "Ticket not found" });
        return;
      }

      if (ticket.status === "used") {
        setVerifyResult({ valid: false, message: "Ticket already checked in", ticket, event: localDB.getEvent(ticket.event_id) ?? undefined });
        return;
      }

      if (!parsed.token) {
        setVerifyResult({ valid: false, message: "Missing QR security token" });
        return;
      }

      const nowWindow = Math.floor(Date.now() / QR_WINDOW_MS);
      const windowToCheck = typeof parsed.window === "number" ? parsed.window : nowWindow;
      const validToken = await verifyQRToken(ticket.qr_secret, windowToCheck, parsed.token);
      if (!validToken) {
        setVerifyResult({ valid: false, message: "Invalid or expired QR token" });
        return;
      }

      ticketDB.markUsed(ticket.id);
      const event = localDB.getEvent(ticket.event_id) ?? undefined;
      auditLogDB.log({
        action: "check_in",
        user_id: userId,
        detail: `${event?.name ?? "Event"} · ${ticket.id} · ${ticket.owner_wallet}`,
      });

      setVerifyResult({
        valid: true,
        message: `Verified: ${event?.name ?? "Ticket"}`,
        ticket,
        event,
      });
      refreshAll();
    } catch (err) {
      console.error("Admin verify failed", err);
      setVerifyResult({ valid: false, message: "Invalid QR code format" });
    } finally {
      setChecking(false);
    }
  };

  // --- Search Tickets ---
  const searchTickets = () => {
    if (!ticketSearch.trim()) return;
    setTicketSearching(true);
    setSearchedTickets([]);
    setTicketSearching(false);
    toast({ title: "Ticket search", description: "Ticket search requires database connection." });
  };

  // --- Event Edit ---
  const openEditEvent = (evt: LocalEvent) => {
    setEditingEvent(evt);
    setEditEventForm({
      name: evt.name,
      description: evt.description ?? "",
      venue: evt.venue,
      location: evt.location ?? "",
      status: evt.status,
    });
    setEditEventOpen(true);
  };

  const saveEditEvent = () => {
    if (!editingEvent) return;
    const events = localDB.getEvents();
    const idx = events.findIndex(e => e.id === editingEvent.id);
    if (idx === -1) return;
    // Mutate via available API
    localDB.updateEventStatus(editingEvent.id, editEventForm.status);
    // For name/venue/description there is no dedicated API, so apply via raw localStorage update
    const raw: LocalEvent[] = JSON.parse(localStorage.getItem("ticketshield_events") || "[]");
    const ri = raw.findIndex(e => e.id === editingEvent.id);
    if (ri !== -1) {
      raw[ri].name = editEventForm.name || raw[ri].name;
      raw[ri].description = editEventForm.description || null;
      raw[ri].venue = editEventForm.venue || raw[ri].venue;
      raw[ri].location = editEventForm.location || null;
      raw[ri].status = editEventForm.status;
      localStorage.setItem("ticketshield_events", JSON.stringify(raw));
      window.dispatchEvent(new StorageEvent("storage", { key: "ticketshield_events" }));
    }
    auditLogDB.log({ action: "event_created", user_id: userId, detail: `Edited event: ${editEventForm.name}` });
    toast({ title: "Event updated" });
    setEditEventOpen(false);
    setEditingEvent(null);
    refreshAll();
  };

  const deleteEvent = (id: string, name: string) => {
    if (!confirm(`Archive and delete ended event "${name}" from active list?`)) return;
    const archived = localDB.archiveEndedEvent(id, userId || undefined);
    if (!archived.ok && "reason" in archived) {
      toast({ title: "Cannot Delete Event", description: archived.reason, variant: "destructive" });
      return;
    }
    auditLogDB.log({ action: "event_created", user_id: userId, detail: `Archived ended event: ${name}` });
    toast({ title: "Event Archived", description: "Event moved to archive storage." });
    refreshAll();
  };

  // ── Analytics derived data ────────────────────────────────────────────────
  const dailySeries = useMemo(
    () => buildDailySeries(allTickets, auditEntries, chartDays),
    [allTickets, auditEntries, chartDays],
  );

  // Tickets by event (pie)
  const ticketsByEvent = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    for (const t of allTickets) {
      const n = t.events?.name ?? "Unknown";
      if (!map[n]) map[n] = { name: n, value: 0 };
      map[n].value += 1;
    }
    return Object.values(map);
  }, [allTickets]);

  // Revenue by tier (bar)
  const revenueByTier = useMemo(() => {
    const map: Record<string, { tier: string; revenue: number; count: number }> = {};
    for (const t of allTickets) {
      const k = t.ticket_tiers?.tier_name ?? "Unknown";
      if (!map[k]) map[k] = { tier: k, revenue: 0, count: 0 };
      map[k].revenue += t.ticket_tiers?.price ?? 0;
      map[k].count += 1;
    }
    return Object.values(map);
  }, [allTickets]);

  // Audit action breakdown (pie)
  const actionBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of auditEntries) {
      map[a.action] = (map[a.action] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [auditEntries]);

  // Fraud / suspicious entries: resale + blocked attempts
  const fraudEntries = useMemo(() => {
    return auditEntries.filter(a => {
      if (fraudFilter === "resale") return a.action === "ticket_resale";
      if (fraudFilter === "blocked") return a.action === "check_in" && a.detail?.toLowerCase().includes("fail");
      return a.action === "ticket_resale" || (a.action === "check_in" && a.detail?.toLowerCase().includes("fail"));
    });
  }, [auditEntries, fraudFilter]);

  // Ticket verification stats
  const verifyStats = useMemo(() => {
    const checkIns = auditEntries.filter(a => a.action === "check_in");
    const used = allTickets.filter(t => t.status === "used").length;
    const active = allTickets.filter(t => t.status === "active").length;
    const listed = allTickets.filter(t => t.status === "listed").length;
    return { checkIns: checkIns.length, used, active, listed, total: allTickets.length };
  }, [auditEntries, allTickets]);

  // Financial summary
  const financials = useMemo(() => {
    const gross = allTickets.reduce((s, t) => s + (t.ticket_tiers?.price ?? 0), 0);
    const resales = auditEntries.filter(a => a.action === "ticket_resale").length;
    // Each event's remaining revenue potential
    const unrealised = events.reduce(
      (sum, e) => sum + (e.ticket_tiers?.reduce((s: number, t: LocalTier) => s + t.remaining_supply * t.price, 0) ?? 0),
      0,
    );
    return { gross, resales, unrealised };
  }, [allTickets, auditEntries, events]);

  // Per-user ticket count for user management
  const userTicketMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of allTickets) {
      map[t.owner_user_id] = (map[t.owner_user_id] ?? 0) + 1;
    }
    return map;
  }, [allTickets]);

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
        <p className="text-muted-foreground">Please connect your wallet to access admin features.</p>
      </div>
    );
  }

  // Require explicit admin role for access to the admin panel UI
  if (!hasRole("admin")) {
    return (
      <div className="p-6 text-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground">Your wallet is connected but does not have admin privileges.</p>
        <p className="text-sm text-muted-foreground mt-2">If you should have access, contact the contract owner or use the Admin Control Panel for owner-only actions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans relative overflow-hidden pb-28 text-foreground">
      {/* Subtle ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[20%] left-[-20%] w-[80%] h-[40%] bg-[#1BA6A6]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-[#7ED4D4]/5 blur-[100px] rounded-full" />
      </div>

      <div className="p-5 max-w-7xl mx-auto relative z-10 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-8 border-b border-[#E5E7EB] pb-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#1BA6A6] flex items-center justify-center shadow-lg shadow-[#1BA6A6]/20">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1BA6A6] mb-1">Blockchain Operations</p>
                <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#1F2933]">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="h-10 gap-2 rounded-xl bg-white border-[#E5E7EB] hover:bg-[#F5F7F8] transition-all text-xs font-bold text-[#6B7280]" 
                onClick={refreshAll}
              >
                <RefreshCw className="h-3 w-3" /> Sync Ledger
              </Button>
              <Button 
                variant="outline" 
                className="h-10 gap-2 rounded-xl bg-[#1BA6A6]/10 border-[#1BA6A6]/20 hover:bg-[#1BA6A6]/20 transition-all text-xs font-bold text-[#1BA6A6]" 
                onClick={() => {
                  if (confirm("This will reset all event data to the latest sample set. Continue?")) {
                    localDB.seedDatabase();
                    refreshAll();
                    toast({ title: "Database Seeded", description: "Project has been updated with future-dated events." });
                  }
                }}
              >
                <Zap className="h-3 w-3" /> Seed Project
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 gap-2 rounded-xl bg-[#1BA6A6] text-white hover:opacity-90 transition-all font-bold shadow-lg shadow-[#1BA6A6]/20">
                    <Plus className="h-4 w-4" /> Create
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white border-[#E5E7EB] rounded-[2rem] shadow-2xl">
                  <DialogHeader className="mb-4">
                    <DialogTitle className="text-2xl font-extrabold tracking-tight text-[#1F2933]">Initialize Event Vault</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 pt-2">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Vault Designation *</Label><Input value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} placeholder="Global Summit 2026" className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Physical Location *</Label><Input value={eventForm.venue} onChange={(e) => setEventForm((prev) => ({ ...prev, venue: e.target.value, location: prev.location || e.target.value }))} placeholder="Madison Square Garden" className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                    </div>
                    <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Protocol Specs</Label><Textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="mt-2 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl resize-none" rows={4} /></div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Activation Date *</Label><Input type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Termination Date</Label><Input type="datetime-local" value={eventForm.end_date} onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })} className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">City/Region</Label><Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="New York, NY" className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Asset Category</Label>
                        <Select value={eventForm.category} onValueChange={(v) => setEventForm({ ...eventForm, category: v })}>
                          <SelectTrigger className="mt-2 h-12 bg-white/5 border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
                            <SelectItem value="music">Music</SelectItem>
                            <SelectItem value="sports">Sports</SelectItem>
                            <SelectItem value="tech">Tech</SelectItem>
                            <SelectItem value="art">Art</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Cover Immutable URI</Label><Input value={eventForm.image_url} onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })} className="mt-2 h-12 bg-white/5 border-white/10 focus:border-amber-500/50 rounded-xl" /></div>
                    
                    {/* Tiers block */}
                    <div className="bg-white/5 border border-white/10 rounded-[1.5rem] p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold tracking-tight text-white">Asset Verification Tiers</Label>
                        <Button variant="outline" size="sm" onClick={addTier} className="gap-2 h-8 rounded-lg bg-black/50 border-white/10 hover:bg-white/10"><Plus className="h-3 w-3" /> Add Tier</Button>
                      </div>
                      {tiers.map((tier, i) => (
                        <div key={i} className="bg-black/40 rounded-[1.25rem] p-4 border border-white/5 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-500/70">Tier {i + 1}</span>
                            {tiers.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10" onClick={() => removeTier(i)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Input placeholder="Tier Class" value={tier.tier_name} onChange={(e) => updateTier(i, "tier_name", e.target.value)} className="bg-white/5 border-white/10 h-10 rounded-lg text-sm" />
                            <Input type="number" placeholder="Value (ETH)" value={tier.price} onChange={(e) => updateTier(i, "price", e.target.value)} step="0.001" className="bg-white/5 border-white/10 h-10 rounded-lg text-sm" />
                            <Input type="number" placeholder="Max Mint" value={tier.total_supply} onChange={(e) => updateTier(i, "total_supply", e.target.value)} className="bg-white/5 border-white/10 h-10 rounded-lg text-sm" />
                            <Input type="number" placeholder="Cap/Wallet" value={tier.max_per_wallet} onChange={(e) => updateTier(i, "max_per_wallet", e.target.value)} className="bg-white/5 border-white/10 h-10 rounded-lg text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-[1.25rem] p-5 flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-bold text-white block">Secondary Market Permitted</Label>
                        <span className="text-xs font-medium text-muted-foreground/60 block mt-0.5">Allow sovereign transfer of assets</span>
                      </div>
                      <Switch checked={eventForm.resale_enabled} onCheckedChange={(v) => setEventForm({ ...eventForm, resale_enabled: v })} className="data-[state=checked]:bg-amber-500" />
                    </div>
                    {eventForm.resale_enabled && (
                      <div className="bg-white/5 border border-white/10 rounded-[1.25rem] p-5 flex items-center justify-between">
                        <div>
                           <Label className="text-sm font-bold text-white block">Sovereign Resale Cap (%)</Label>
                           <span className="text-xs font-medium text-muted-foreground/60 block mt-0.5">Maximum anti-scalping protocol limit</span>
                        </div>
                        <Input type="number" value={eventForm.resale_price_cap_percent} onChange={(e) => setEventForm({ ...eventForm, resale_price_cap_percent: e.target.value })} className="w-24 h-10 bg-black/40 border-white/10 rounded-lg text-center font-bold" />
                      </div>
                    )}
                    
                    <div className="flex gap-4 pt-4 mt-8 border-t border-white/5">
                      <Button variant="outline" className="flex-1 h-12 rounded-xl border-white/10 bg-black/40 hover:bg-white/5 text-sm font-bold" onClick={() => handleCreateEvent("draft")} disabled={saving}>Store Draft</Button>
                      <Button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold shadow-lg shadow-amber-500/20" onClick={() => handleCreateEvent("published")} disabled={saving}>{saving ? "Deploying..." : "Deploy to Mainnet"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

        {/* ── KPI Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10 mt-6 relative z-10">
          <StatCard icon={Calendar}    label="Total Asset Pools"   value={stats.events}   color="#6366f1" sub={`${events.filter(e=>e.status==="published").length} active vaults`} />
          <StatCard icon={Users}       label="Verified Sovereigns" value={stats.users}  color="#10b981" />
          <StatCard icon={Ticket}      label="Minted Tickets"   value={stats.tickets}  color="#0ea5e9" sub={`${verifyStats.used} burned · ${verifyStats.active} holding`} />
          <StatCard icon={DollarSign}  label="Protocol Value"  value={`${stats.revenue.toFixed(4)} ETH`} color="#f59e0b" sub={`${financials.resales} secondary swaps`} />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <Tabs defaultValue="analytics" className="space-y-6 relative z-10">
          <TabsList className="bg-white border border-[#E5E7EB] rounded-2xl flex-wrap h-auto gap-2 p-2 w-full justify-start shadow-sm">
            <TabsTrigger value="analytics" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><BarChart2 className="h-4 w-4 text-[#1BA6A6]" />Analytics</TabsTrigger>
            <TabsTrigger value="events" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><Calendar className="h-4 w-4 text-[#1BA6A6]" />Vaults</TabsTrigger>
            <TabsTrigger value="users" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><Users className="h-4 w-4 text-[#1BA6A6]" />Identities</TabsTrigger>
            <TabsTrigger value="fraud" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><AlertTriangle className="h-4 w-4 text-red-500" />Security</TabsTrigger>
            <TabsTrigger value="verify" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><ScanLine className="h-4 w-4 text-[#1BA6A6]" />Scanner</TabsTrigger>
            <TabsTrigger value="financial" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#FACC15]/10 data-[state=active]:text-[#FACC15] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]"><FileText className="h-4 w-4 text-[#FACC15]" />Finances</TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]">
              Ledger
              {auditEntries.length > 0 && <span className="flex items-center justify-center bg-[#1BA6A6] text-white text-[10px] rounded-full h-5 w-5">{auditEntries.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="kyc" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-[#1BA6A6]/10 data-[state=active]:text-[#1BA6A6] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]">
              <UserCheck className="h-4 w-4 text-[#1BA6A6]" />KYC
              {kycSubmissions.length > 0 && <span className="flex items-center justify-center bg-[#1BA6A6] text-white font-black text-[10px] rounded-full h-5 w-5">{kycSubmissions.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-2 h-10 px-4 rounded-xl data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest text-[#6B7280]">
              <Zap className="h-4 w-4 text-emerald-500 animate-pulse" />MemPool
              {liveTxs.length > 0 && (
                <span className="flex items-center justify-center bg-emerald-500 text-white text-[10px] rounded-full h-5 w-5 shadow-sm">{liveTxs.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════
              ANALYTICS TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="analytics" className="space-y-5">
            {/* Range selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Range:</span>
              {([7, 14, 30] as const).map(d => (
                <Button key={d} size="sm" variant={chartDays === d ? "default" : "outline"} className="h-7 text-xs px-3" onClick={() => setChartDays(d)}>
                  {d}d
                </Button>
              ))}
            </div>

            {/* Ticket sales area chart */}
            <div className="glass rounded-2xl p-5">
              <SectionTitle>Ticket Sales — Last {chartDays} Days</SectionTitle>
              {dailySeries.every(d => d.tickets === 0) ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No ticket sales data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailySeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="checkinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#0f0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#9ca3af" }} />
                    <Legend />
                    <Area type="monotone" dataKey="tickets" name="Tickets Sold" stroke="#6366f1" fill="url(#ticketGrad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="checkins" name="Check-ins" stroke="#06b6d4" fill="url(#checkinGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Revenue line chart */}
            <div className="glass rounded-2xl p-5">
              <SectionTitle>Revenue (ETH) — Last {chartDays} Days</SectionTitle>
              {dailySeries.every(d => d.revenue === 0) ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailySeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ background: "#0f0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#9ca3af" }} />
                    <Line type="monotone" dataKey="revenue" name="Revenue (ETH)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Tickets by Event pie */}
              <div className="glass rounded-2xl p-5">
                <SectionTitle>Tickets by Event</SectionTitle>
                {ticketsByEvent.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ticketsByEvent} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ x, y, name, percent }: { x: number; y: number; name: string; percent: number }) => (<text x={x} y={y} fill="#e5e7eb" textAnchor="middle" dominantBaseline="central" fontSize={10}>{`${name} ${(percent*100).toFixed(0)}%`}</text>)} labelLine={false} stroke="none">
                        {ticketsByEvent.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#9ca3af" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Revenue by tier bar */}
              <div className="glass rounded-2xl p-5">
                <SectionTitle>Revenue by Tier</SectionTitle>
                {revenueByTier.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={revenueByTier} margin={{ top: 4, right: 4, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip contentStyle={{ background: "#0f0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#9ca3af" }} />
                      <Bar dataKey="revenue" name="Revenue (ETH)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Audit Action breakdown */}
            {actionBreakdown.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <SectionTitle>Platform Activity Breakdown</SectionTitle>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={actionBreakdown} layout="vertical" margin={{ left: 16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ background: "#0f0a1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#9ca3af" }} />
                    <Bar dataKey="value" name="Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              EVENTS TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="events" className="space-y-3">
            {events.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No events yet. Click "Create Event" to add one.</p>
              </div>
            )}
            {archivedEvents.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-amber-300">Archived Ended Events</h4>
                  <Badge className="bg-amber-500/20 text-amber-300">{archivedEvents.length}</Badge>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {archivedEvents.slice(0, 8).map((record) => (
                    <div key={record.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                      <span className="truncate">{record.event.name}</span>
                      <span className="shrink-0">{format(parseISO(record.archived_at), "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {events.map((event) => {
              const endAt = new Date(event.end_date || event.date).getTime();
              const hasEnded = !Number.isNaN(endAt) && Date.now() >= endAt;
              const sold = event.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) ?? 0;
              const total = event.ticket_tiers?.reduce((s, t) => s + t.total_supply, 0) ?? 0;
              const rev = event.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply) * t.price, 0) ?? 0;
              const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
              return (
                <div key={event.id} className="glass rounded-2xl p-5 space-y-3 hover:border-primary/20 transition-colors border border-transparent">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{event.name}</h3>
                        <Badge className={
                          event.status === "published" ? "bg-neon-green/20 text-neon-green" :
                          event.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                          event.status === "completed"  ? "bg-cyan-500/20 text-cyan-400" :
                          "bg-muted text-muted-foreground"
                        }>{event.status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{event.category}</Badge>
                        {/* On-chain status badge */}
                        {event.contract_event_id !== undefined ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1">
                            <CheckCircle className="h-3 w-3" /> On-Chain #{event.contract_event_id}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Not on Chain
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{event.venue} {event.location ? `· ${event.location}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(event.date), "MMM d, yyyy · h:mm a")}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Register on chain if missing */}
                      {event.contract_event_id === undefined && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs"
                          disabled={registeringChain[event.id] || !isConnected}
                          onClick={() => handleRegisterOnChain(event)}
                        >
                          <RefreshCw className={`h-3 w-3 ${registeringChain[event.id] ? "animate-spin" : ""}`} />
                          {registeringChain[event.id] ? "Registering…" : "Register on Chain"}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditEvent(event)}>
                        <Edit className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => loadTiers(event.id)}>
                        <Ticket className="h-3 w-3" /> Tiers
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => deleteEvent(event.id, event.name)}
                        disabled={!hasEnded}
                        title={hasEnded ? "Archive ended event" : "Only ended events can be deleted"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {/* Sales progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{sold}/{total} tickets sold</span>
                      <span className="text-neon-green font-medium">{rev.toFixed(4)} ETH</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  {/* Tiers mini-table */}
                  {event.ticket_tiers?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                      {event.ticket_tiers.map(t => (
                        <div key={t.id} className="rounded-lg bg-muted/20 border border-white/[0.05] px-3 py-2">
                          <p className="text-[11px] font-medium truncate">{t.tier_name}</p>
                          <p className="text-xs text-primary font-mono">{t.price} ETH</p>
                          <p className="text-[10px] text-muted-foreground">{t.remaining_supply}/{t.total_supply} left</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              USERS TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="users" className="space-y-3">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Registered Users</SectionTitle>
                <span className="text-sm text-muted-foreground">{profiles.length} total</span>
              </div>
              {profiles.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No registered users yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {profiles.map((p) => {
                    const isAdmin = p.id === "admin-001";
                    const ticketCount = userTicketMap[p.id] ?? 0;
                    const userAudit = auditEntries.filter(a => a.user_id === p.id);
                    const expanded = expandedUser === p.id;
                    return (
                      <div key={p.id} className="rounded-xl border border-white/[0.06] bg-muted/[0.08] overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => setExpandedUser(expanded ? null : p.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                              {p.email[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.email}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{p.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={isAdmin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}>
                              {isAdmin ? "admin" : "user"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{ticketCount} tickets</span>
                            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                        {expanded && (
                          <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity ({userAudit.length} events)</p>
                            {userAudit.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No activity recorded.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {userAudit.slice(0, 20).map(a => (
                                  <div key={a.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ACTION_COLORS[a.action] ?? "#6b7280" }} />
                                      <span className="text-muted-foreground">{a.action.replace(/_/g, " ")}</span>
                                      {a.event_name && <span className="text-foreground/70">· {a.event_name}</span>}
                                    </div>
                                    <span className="text-muted-foreground/60 flex-shrink-0">{format(parseISO(a.timestamp), "MMM d, HH:mm")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              FRAUD MONITORING TAB (Stitch Redesign)
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="fraud" className="space-y-6">
            
            {/* Critical Alert Banner (Mocked Live Status) */}
            <div className="relative overflow-hidden bg-[#1a0b0b] rounded-2xl border border-error/30 shadow-[0_0_30px_rgba(255,180,171,0.15)] p-6">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertTriangle className="h-24 w-24 text-error" />
              </div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-error/20 p-2.5 rounded-xl border border-error/30">
                    <AlertTriangle className="text-error h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black bg-error text-error-foreground px-2 py-1 rounded-md">CRITICAL</span>
                </div>
                <h3 className="font-headline font-extrabold text-xl text-error mb-1">Large Scale Duplicate Attempt</h3>
                <p className="text-on-surface-variant/80 text-xs mb-6">Main Gate B • Immediate action required</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-on-surface-variant font-medium mb-1">Impacted</p>
                    <p className="font-bold text-lg leading-none">{fraudEntries.filter(a=>a.action==="check_in").length} <span className="text-xs font-medium text-on-surface-variant">Tix</span></p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-on-surface-variant font-medium mb-1">Certainty</p>
                    <p className="font-bold text-lg leading-none text-tertiary">99.4%</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button className="w-full bg-error text-error-foreground font-black text-sm h-12 rounded-xl hover:bg-error/90 transition-colors shadow-lg shadow-error/20">
                    LOCK ENTRY POINT
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="text-primary h-5 w-5" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Resales</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-headline font-extrabold leading-none">{auditEntries.filter(a=>a.action==="ticket_resale").length}</span>
                  <span className="text-[10px] text-primary font-bold mt-1">Monitored</span>
                </div>
              </div>
              <div className="bg-surface-container rounded-2xl p-4 border border-white/5 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="text-tertiary h-5 w-5" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Saved Loss</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-headline font-extrabold leading-none text-tertiary">$12.4K</span>
                  <span className="text-[10px] text-on-surface-variant font-medium mt-1">Estimated Today</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-xl font-extrabold">Activity Feed</h3>
                <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                  {(["all", "resale", "blocked"] as const).map(f => (
                    <button key={f} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${fraudFilter === f ? "bg-primary text-background" : "text-on-surface-variant hover:text-white"}`} onClick={() => setFraudFilter(f)}>
                      {f === "resale" ? "Resales" : f}
                    </button>
                  ))}
                </div>
              </div>

              {fraudEntries.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground glass-panel rounded-2xl border border-white/5">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No suspicious activity detected. 🎉</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fraudEntries.map(e => {
                    const isResale = e.action === "ticket_resale";
                    return (
                      <div key={e.id} className="bg-surface-container-high rounded-2xl p-4 border border-white/5 hover:bg-surface-variant transition-colors group">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border ${isResale ? "bg-tertiary/10 border-tertiary/20 text-tertiary" : "bg-error/10 border-error/20 text-error"}`}>
                            {isResale ? <RefreshCw className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${isResale ? "bg-tertiary/20 text-tertiary" : "bg-error/20 text-error"}`}>
                                {isResale ? "Market Monitor" : "High Risk"}
                              </span>
                              <span className="text-[10px] font-medium text-on-surface-variant">{format(parseISO(e.timestamp), "HH:mm")}</span>
                            </div>
                            <h4 className="font-bold text-sm mb-0.5 truncate">{e.action.replace(/_/g, " ")}</h4>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              {e.wallet && <span className="font-mono text-[11px] text-primary">0x{e.wallet.slice(0, 4)}...{e.wallet.slice(-4)}</span>}
                              {" "} • {e.event_name ? e.event_name : "System"}
                              {" "}{e.detail && <span className="opacity-80">— {e.detail}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Resale heatmap by event */}
            {events.length > 0 && (
              <div className="bg-surface-container rounded-2xl p-5 border border-white/5">
                <SectionTitle>Resale Activity by Event</SectionTitle>
                <div className="space-y-3 mt-3">
                  {events.map(ev => {
                    const resales = auditEntries.filter(a => a.action === "ticket_resale" && a.event_id === ev.id).length;
                    const sold = (ev.ticket_tiers?.reduce((s, t) => s + (t.total_supply - t.remaining_supply), 0) ?? 0);
                    const resalePct = sold > 0 ? Math.round((resales / sold) * 100) : 0;
                    return (
                      <div key={ev.id} className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-on-surface-variant truncate flex-1 mr-4">{ev.name}</span>
                          <span className={resalePct > 30 ? "text-error font-bold" : resalePct > 15 ? "text-tertiary font-bold" : "text-neon-green"}>
                            {resales} resales ({resalePct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full rounded-full ${resalePct > 30 ? "bg-error" : resalePct > 15 ? "bg-tertiary" : "bg-neon-green"}`} style={{ width: `${resalePct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              VERIFY TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="verify" className="space-y-5">
            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Ticket}      label="Total Tickets"   value={verifyStats.total}   color="#6366f1" />
              <StatCard icon={CheckCircle} label="Active"          value={verifyStats.active}  color="#22c55e" />
              <StatCard icon={Eye}         label="Used / Checked"  value={verifyStats.used}    color="#06b6d4" />
              <StatCard icon={ScanLine}    label="Check-ins Logged" value={verifyStats.checkIns} color="#8b5cf6" />
            </div>

            {/* Utilisation bar */}
            {verifyStats.total > 0 && (
              <div className="glass rounded-2xl p-5 space-y-4">
                <SectionTitle>Ticket Utilisation</SectionTitle>
                {[
                  { label: "Active", value: verifyStats.active, color: "#22c55e" },
                  { label: "Used",   value: verifyStats.used,   color: "#06b6d4" },
                  { label: "Listed", value: verifyStats.listed, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span style={{ color: s.color }}>{s.value} ({verifyStats.total > 0 ? Math.round(s.value/verifyStats.total*100) : 0}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${verifyStats.total > 0 ? s.value/verifyStats.total*100 : 0}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual verify input */}
            <div className="glass rounded-2xl p-6 max-w-lg mx-auto space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ScanLine className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-center">Manual QR Verification</h3>
              <p className="text-muted-foreground text-center text-sm">Paste ticket QR payload to verify and check in</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/check-in")}>Open Camera Scanner Console</Button>
              <div className="space-y-3">
                <Input
                  placeholder='{"ticketId":"...","window":12345,"token":"..."}'
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button className="w-full gradient-primary" onClick={handleVerify} disabled={checking || !qrInput.trim()}>
                  {checking ? "Verifying..." : "Verify & Check In"}
                </Button>
              </div>
              {verifyResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-xl p-5 text-center ${verifyResult.valid ? "bg-neon-green/10 border border-neon-green/30" : "bg-destructive/10 border border-destructive/30"}`}
                >
                  {verifyResult.valid
                    ? <CheckCircle className="h-10 w-10 text-neon-green mx-auto mb-2" />
                    : <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />}
                  <p className="font-semibold">{verifyResult.message}</p>
                </motion.div>
              )}
            </div>

            {/* Recent check-in log */}
            <div className="glass rounded-2xl p-5">
              <SectionTitle>Recent Check-ins</SectionTitle>
              {auditEntries.filter(a => a.action === "check_in").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No check-ins recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-white/[0.05]">
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Event</th>
                        <th className="pb-2 pr-4">Wallet</th>
                        <th className="pb-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEntries.filter(a => a.action === "check_in").slice(0, 30).map(a => (
                        <tr key={a.id} className="border-b border-white/[0.03] hover:bg-muted/10">
                          <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{format(parseISO(a.timestamp), "MMM d, HH:mm")}</td>
                          <td className="py-2 pr-4 text-xs">{a.event_name ?? "—"}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{a.wallet ? `${a.wallet.slice(0,8)}…${a.wallet.slice(-4)}` : "—"}</td>
                          <td className="py-2 text-xs text-muted-foreground">{a.detail ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              FINANCIALS TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="financial" className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-3">
              <StatCard icon={DollarSign}  label="Gross Revenue"         value={`${financials.gross.toFixed(4)} ETH`}       color="#22c55e" />
              <StatCard icon={TrendingUp}  label="Unrealised Potential"  value={`${financials.unrealised.toFixed(4)} ETH`}  color="#6366f1" />
              <StatCard icon={RefreshCw}   label="Resale Transactions"   value={financials.resales}                          color="#f59e0b" />
            </div>

            {/* Revenue breakdown table per event */}
            <div className="glass rounded-2xl p-5">
              <SectionTitle>Revenue by Event</SectionTitle>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-white/[0.05]">
                        <th className="pb-2 pr-4">Event</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4 text-right">Sold</th>
                        <th className="pb-2 pr-4 text-right">Remaining</th>
                        <th className="pb-2 pr-4 text-right">Revenue</th>
                        <th className="pb-2 text-right">Potential</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(ev => {
                        const sold    = ev.ticket_tiers?.reduce((s,t) => s + (t.total_supply - t.remaining_supply), 0) ?? 0;
                        const rem     = ev.ticket_tiers?.reduce((s,t) => s + t.remaining_supply, 0) ?? 0;
                        const rev     = ev.ticket_tiers?.reduce((s,t) => s + (t.total_supply - t.remaining_supply) * t.price, 0) ?? 0;
                        const pot     = ev.ticket_tiers?.reduce((s,t) => s + t.remaining_supply * t.price, 0) ?? 0;
                        return (
                          <tr key={ev.id} className="border-b border-white/[0.03] hover:bg-muted/10">
                            <td className="py-2.5 pr-4 font-medium">{ev.name}</td>
                            <td className="py-2.5 pr-4">
                              <Badge className={ev.status === "published" ? "bg-neon-green/20 text-neon-green text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{ev.status}</Badge>
                            </td>
                            <td className="py-2.5 pr-4 text-right">{sold}</td>
                            <td className="py-2.5 pr-4 text-right text-muted-foreground">{rem}</td>
                            <td className="py-2.5 pr-4 text-right text-neon-green font-mono">{rev.toFixed(4)}</td>
                            <td className="py-2.5 text-right text-primary font-mono">{pot.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-white/[0.1]">
                        <td colSpan={4} className="py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Total</td>
                        <td className="py-2.5 text-right text-neon-green font-bold font-mono">
                          {events.reduce((s,ev) => s + (ev.ticket_tiers?.reduce((ss,t) => ss + (t.total_supply - t.remaining_supply) * t.price, 0) ?? 0),0).toFixed(4)}
                        </td>
                        <td className="py-2.5 text-right text-primary font-bold font-mono">
                          {events.reduce((s,ev) => s + (ev.ticket_tiers?.reduce((ss,t) => ss + t.remaining_supply * t.price, 0) ?? 0),0).toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tier breakdown */}
            <div className="glass rounded-2xl p-5">
              <SectionTitle>Revenue by Ticket Tier</SectionTitle>
              {revenueByTier.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No tickets sold yet.</p>
              ) : (
                <div className="space-y-3">
                  {revenueByTier.sort((a,b)=>b.revenue-a.revenue).map((r,i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate">{r.tier}</span>
                          <span className="text-neon-green font-mono ml-2 flex-shrink-0">{r.revenue.toFixed(4)} ETH</span>
                        </div>
                        <Progress value={financials.gross > 0 ? (r.revenue/financials.gross)*100 : 0} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{r.count} tickets</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export hint */}
            <div className="glass rounded-2xl p-5 flex items-center gap-3">
              <Download className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">To export a CSV report, open browser DevTools → Application → Local Storage → copy <code className="font-mono text-xs bg-muted/30 px-1 rounded">ticketshield_tickets</code> data.</p>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              AUDIT LOG TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="audit" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 relative min-w-0">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by action, wallet, event, tx hash…"
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="text-sm pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => { auditLogDB.clear(); setAuditEntries([]); }}>
                Clear Log
              </Button>
            </div>

            {auditEntries.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No audit entries yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto glass rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-white/[0.05]">
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Wallet / User</th>
                      <th className="px-4 py-3">TX Hash</th>
                      <th className="px-4 py-3">Detail</th>
                      <th className="px-4 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries
                      .filter((e) => {
                        if (!auditFilter.trim()) return true;
                        const q = auditFilter.toLowerCase();
                        return (
                          e.action.includes(q) ||
                          (e.wallet?.toLowerCase().includes(q) ?? false) ||
                          (e.event_name?.toLowerCase().includes(q) ?? false) ||
                          (e.tx_hash?.toLowerCase().includes(q) ?? false) ||
                          (e.detail?.toLowerCase().includes(q) ?? false)
                        );
                      })
                      .map((entry) => (
                        <tr key={entry.id} className="border-b border-white/[0.03] hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2.5">
                            <Badge className="text-[10px] whitespace-nowrap"
                              style={{ background: `${ACTION_COLORS[entry.action] ?? "#6b7280"}22`, color: ACTION_COLORS[entry.action] ?? "#6b7280" }}>
                              {entry.action.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{entry.event_name ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {entry.wallet
                              ? `${entry.wallet.slice(0,8)}…${entry.wallet.slice(-4)}`
                              : entry.user_id ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {entry.tx_hash ? `${entry.tx_hash.slice(0,10)}…` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{entry.detail ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground text-right whitespace-nowrap">
                            {format(parseISO(entry.timestamp), "MMM d, HH:mm:ss")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              KYC TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="kyc" className="space-y-3">
            {kycSubmissions.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No pending KYC submissions</p>
              </div>
            ) : (
              kycSubmissions.map((sub) => (
                <div key={sub.id} className="glass rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{sub.full_name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{sub.wallet_address?.slice(0, 14)}...</p>
                      <p className="text-xs text-muted-foreground">{sub.country} · {sub.id_type} · submitted {new Date(sub.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => { setKycSubmissions(prev => prev.filter(s => s.id !== sub.id)); toast({ title: "KYC Approved" }); }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => { setKycSubmissions(prev => prev.filter(s => s.id !== sub.id)); toast({ title: "KYC Rejected", variant: "destructive" }); }}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              LIVE TRANSACTIONS TAB
          ══════════════════════════════════════════════════════════ */}
          <TabsContent value="live">
            <div className="space-y-4">
              {/* Network info bar */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Blockchain Network</span>
                <span className="px-2 py-0.5 rounded-full bg-muted font-mono">
                  Hardhat · <span className="text-primary">localhost:8545</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-muted font-mono">
                  Sepolia testnet available
                </span>
                {contractAddress ? (
                  <span className="font-mono text-primary/70" title={contractAddress}>
                    Contract: {contractAddress.slice(0, 10)}…{contractAddress.slice(-6)}
                  </span>
                ) : (
                  <span className="text-amber-400">VITE_CONTRACT_ADDRESS not set</span>
                )}
              </div>

              <TransactionFeed
                transactions={liveTxs}
                isListening={isListening}
                error={monitorError}
                onClear={clearTransactions}
                maxVisible={12}
              />

              {/* Legend */}
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Event types monitored</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(["TicketMinted","ResaleCompleted","ResaleOffered","ResaleOfferCancelled","TicketCheckedIn","EventCreated"] as const).map(type => {
                    const colors: Record<string, string> = {
                      TicketMinted: "text-emerald-400",
                      ResaleCompleted: "text-blue-400",
                      ResaleOffered: "text-amber-400",
                      ResaleOfferCancelled: "text-rose-400",
                      TicketCheckedIn: "text-cyan-400",
                      EventCreated: "text-purple-400",
                    };
                    const labels: Record<string, string> = {
                      TicketMinted: "Ticket Minted",
                      ResaleCompleted: "Resale Completed",
                      ResaleOffered: "Listed for Resale",
                      ResaleOfferCancelled: "Resale Cancelled",
                      TicketCheckedIn: "Check-In",
                      EventCreated: "Event Created",
                    };
                    return (
                      <div key={type} className={`flex items-center gap-1.5 text-xs ${colors[type]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {labels[type]}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Edit Event Dialog ──────────────────────────────────────── */}
        <Dialog open={editEventOpen} onOpenChange={setEditEventOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={editEventForm.name} onChange={e=>setEditEventForm({...editEventForm,name:e.target.value})} className="mt-1" /></div>
              <div><Label>Description</Label><Textarea value={editEventForm.description} onChange={e=>setEditEventForm({...editEventForm,description:e.target.value})} className="mt-1" rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Venue</Label><Input value={editEventForm.venue} onChange={e=>setEditEventForm({...editEventForm,venue:e.target.value})} className="mt-1" /></div>
                <div><Label>Location</Label><Input value={editEventForm.location} onChange={e=>setEditEventForm({...editEventForm,location:e.target.value})} className="mt-1" /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editEventForm.status} onValueChange={v=>setEditEventForm({...editEventForm,status:v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={()=>setEditEventOpen(false)}>Cancel</Button>
                <Button className="flex-1 gradient-primary" onClick={saveEditEvent}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Tier Edit Dialog ───────────────────────────────────────── */}
        <Dialog open={tiersOpen} onOpenChange={setTiersOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Manage Ticket Tiers</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              {eventTiers.map((tier) => (
                <div key={tier.id} className="glass rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{tier.tier_name}</span>
                    <Badge>{tier.remaining_supply}/{tier.total_supply} left</Badge>
                  </div>
                  {editingTier?.id === tier.id ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Price (ETH)</Label><Input type="number" value={editingTier.price} onChange={(e) => setEditingTier({ ...editingTier, price: e.target.value })} step="0.001" /></div>
                      <div><Label className="text-xs">Total Supply</Label><Input type="number" value={editingTier.total_supply} onChange={(e) => setEditingTier({ ...editingTier, total_supply: e.target.value })} /></div>
                      <Button size="sm" onClick={() => updateTierPrice(tier.id, parseFloat(editingTier.price), parseInt(editingTier.total_supply))}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{tier.price} ETH · Max {tier.max_per_wallet}/wallet</span>
                      <Button variant="outline" size="sm" onClick={() => setEditingTier({ id: tier.id, price: tier.price.toString(), total_supply: tier.total_supply.toString() })} className="gap-1">
                        <Edit className="h-3 w-3" /> Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {eventTiers.length === 0 && <p className="text-center text-muted-foreground py-4">No tiers for this event.</p>}
            </div>
          </DialogContent>
        </Dialog>

      </motion.div>
      </div>
    </div>
  );
};

export default AdminPanel;
