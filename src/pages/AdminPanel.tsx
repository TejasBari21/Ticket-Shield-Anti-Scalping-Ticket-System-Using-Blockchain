import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, Users, Ticket, Calendar, Activity, Plus, Trash2,
  ScanLine, CheckCircle, XCircle, Search, Edit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TierForm {
  tier_name: string;
  price: string;
  total_supply: string;
  max_per_wallet: string;
}

interface VerificationResult {
  valid: boolean;
  message: string;
  ticket?: any;
  event?: any;
}

const AdminPanel = () => {
  const { isConnected, hasRole, userId } = useWallet();
  const { toast } = useToast();
  const [stats, setStats] = useState({ events: 0, tickets: 0, users: 0, transactions: 0 });
  const [profiles, setProfiles] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [eventTiers, setEventTiers] = useState<any[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);

  // Verify tickets
  const [qrInput, setQrInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);

  // Ticket search
  const [ticketSearch, setTicketSearch] = useState("");
  const [searchedTickets, setSearchedTickets] = useState<any[]>([]);
  const [ticketSearching, setTicketSearching] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchAll = async () => {
      const [eventsRes, profilesRes, txRes] = await Promise.all([
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*, user_roles(role)"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      setEvents(eventsRes.data || []);
      setProfiles(profilesRes.data || []);
      setTransactions(txRes.data || []);
      setStats({
        events: eventsRes.data?.length || 0,
        users: profilesRes.data?.length || 0,
        tickets: 0,
        transactions: txRes.data?.length || 0,
      });
      setLoading(false);
    };
    fetchAll();
  }, [userId]);

  const refreshEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents(data || []);
  };

  const updateEventStatus = async (eventId: string, status: string) => {
    await supabase.from("events").update({ status: status as any }).eq("id", eventId);
    toast({ title: `Event ${status}` });
    refreshEvents();
  };

  // --- Create Event ---
  const resetEventForm = () => {
    setEventForm({ name: "", description: "", date: "", end_date: "", venue: "", location: "", image_url: "", category: "general", resale_enabled: true, resale_price_cap_percent: "100" });
    setTiers([{ tier_name: "General Admission", price: "0.01", total_supply: "100", max_per_wallet: "4" }]);
  };

  const handleCreateEvent = async (status: "draft" | "published") => {
    if (!userId || !eventForm.name || !eventForm.date || !eventForm.venue) {
      toast({ title: "Missing fields", description: "Fill in name, date, and venue.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: event, error: eventError } = await supabase.from("events").insert({
        organizer_id: userId,
        name: eventForm.name,
        description: eventForm.description || null,
        date: new Date(eventForm.date).toISOString(),
        end_date: eventForm.end_date ? new Date(eventForm.end_date).toISOString() : null,
        venue: eventForm.venue,
        location: eventForm.location || null,
        image_url: eventForm.image_url || null,
        category: eventForm.category,
        status,
        resale_enabled: eventForm.resale_enabled,
        resale_price_cap_percent: parseInt(eventForm.resale_price_cap_percent) || 100,
      }).select().single();
      if (eventError) throw eventError;

      if (event && tiers.length > 0) {
        const tierData = tiers.filter(t => t.tier_name).map(t => ({
          event_id: (event as any).id,
          tier_name: t.tier_name,
          price: parseFloat(t.price) || 0,
          total_supply: parseInt(t.total_supply) || 100,
          remaining_supply: parseInt(t.total_supply) || 100,
          max_per_wallet: parseInt(t.max_per_wallet) || 4,
        }));
        const { error: tierError } = await supabase.from("ticket_tiers").insert(tierData);
        if (tierError) throw tierError;
      }

      toast({ title: "Event Created! 🎉", description: status === "published" ? "Event is now live." : "Saved as draft." });
      setCreateOpen(false);
      resetEventForm();
      refreshEvents();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
  const loadTiers = async (eventId: string) => {
    setSelectedEventId(eventId);
    const { data } = await supabase.from("ticket_tiers").select("*").eq("event_id", eventId);
    setEventTiers(data || []);
    setTiersOpen(true);
  };

  const updateTierPrice = async (tierId: string, price: number, supply: number) => {
    const { error } = await supabase.from("ticket_tiers").update({ price, total_supply: supply, remaining_supply: supply }).eq("id", tierId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tier updated" });
      if (selectedEventId) loadTiers(selectedEventId);
    }
    setEditingTier(null);
  };

  // --- Verify Ticket ---
  const handleVerify = async () => {
    if (!qrInput.trim()) return;
    setChecking(true);
    setVerifyResult(null);
    try {
      let parsed: { ticketId: string; secret: string };
      try { parsed = JSON.parse(qrInput); } catch {
        setVerifyResult({ valid: false, message: "Invalid QR code format" });
        return;
      }
      const { data: ticket } = await supabase
        .from("tickets")
        .select("*, events(id, name, date, venue), ticket_tiers(tier_name)")
        .eq("id", parsed.ticketId)
        .single();

      if (!ticket) { setVerifyResult({ valid: false, message: "Ticket not found" }); return; }
      if ((ticket as any).qr_secret !== parsed.secret) { setVerifyResult({ valid: false, message: "Invalid ticket secret" }); return; }
      if ((ticket as any).status === "used") { setVerifyResult({ valid: false, message: "Ticket already used", ticket }); return; }
      if ((ticket as any).status !== "active") { setVerifyResult({ valid: false, message: `Ticket status: ${(ticket as any).status}`, ticket }); return; }

      const { error: checkInError } = await supabase.from("check_ins").insert({
        ticket_id: (ticket as any).id, event_id: (ticket as any).event_id, checked_in_by: userId,
      });
      if (checkInError) {
        if (checkInError.message.includes("duplicate")) {
          setVerifyResult({ valid: false, message: "Already checked in", ticket });
        } else throw checkInError;
        return;
      }
      await supabase.from("tickets").update({ status: "used" as any }).eq("id", (ticket as any).id);
      setVerifyResult({ valid: true, message: "Check-in successful!", ticket, event: (ticket as any).events });
      toast({ title: "✅ Check-in Verified" });
    } catch (err: any) {
      setVerifyResult({ valid: false, message: err.message || "Verification failed" });
    } finally { setChecking(false); }
  };

  // --- Search Tickets ---
  const searchTickets = async () => {
    if (!ticketSearch.trim()) return;
    setTicketSearching(true);
    const { data } = await supabase
      .from("tickets")
      .select("*, events(name), ticket_tiers(tier_name, price)")
      .or(`id.eq.${ticketSearch},owner_wallet.ilike.%${ticketSearch}%`)
      .limit(20);
    setSearchedTickets(data || []);
    setTicketSearching(false);
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground">Connect your wallet and ensure you have admin privileges.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary gap-2"><Plus className="h-4 w-4" /> Create Event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Event Name *</Label><Input value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} placeholder="My Event" className="mt-1" /></div>
                  <div><Label>Venue *</Label><Input value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} placeholder="Madison Square Garden" className="mt-1" /></div>
                </div>
                <div><Label>Description</Label><Textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="mt-1" rows={3} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Start Date *</Label><Input type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="mt-1" /></div>
                  <div><Label>End Date</Label><Input type="datetime-local" value={eventForm.end_date} onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })} className="mt-1" /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} className="mt-1" /></div>
                  <div>
                    <Label>Category</Label>
                    <Select value={eventForm.category} onValueChange={(v) => setEventForm({ ...eventForm, category: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="tech">Tech</SelectItem>
                        <SelectItem value="art">Art</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Image URL</Label><Input value={eventForm.image_url} onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })} className="mt-1" /></div>

                {/* Ticket Tiers */}
                <div className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Ticket Tiers</Label>
                    <Button variant="outline" size="sm" onClick={addTier} className="gap-1"><Plus className="h-3 w-3" /> Add</Button>
                  </div>
                  {tiers.map((tier, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Tier {i + 1}</span>
                        {tiers.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeTier(i)}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Tier name" value={tier.tier_name} onChange={(e) => updateTier(i, "tier_name", e.target.value)} />
                        <Input type="number" placeholder="Price (ETH)" value={tier.price} onChange={(e) => updateTier(i, "price", e.target.value)} step="0.001" />
                        <Input type="number" placeholder="Supply" value={tier.total_supply} onChange={(e) => updateTier(i, "total_supply", e.target.value)} />
                        <Input type="number" placeholder="Max/wallet" value={tier.max_per_wallet} onChange={(e) => updateTier(i, "max_per_wallet", e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resale */}
                <div className="flex items-center justify-between">
                  <Label>Enable Resale</Label>
                  <Switch checked={eventForm.resale_enabled} onCheckedChange={(v) => setEventForm({ ...eventForm, resale_enabled: v })} />
                </div>
                {eventForm.resale_enabled && (
                  <div><Label>Max Resale Price (%)</Label><Input type="number" value={eventForm.resale_price_cap_percent} onChange={(e) => setEventForm({ ...eventForm, resale_price_cap_percent: e.target.value })} className="mt-1 w-32" /></div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleCreateEvent("draft")} disabled={saving}>Save Draft</Button>
                  <Button className="flex-1 gradient-primary" onClick={() => handleCreateEvent("published")} disabled={saving}>{saving ? "Creating..." : "Publish"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-muted-foreground mb-8">Platform management, event creation, tickets & verification</p>

        {/* Stats */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Calendar, label: "Events", value: stats.events, color: "text-primary" },
            { icon: Users, label: "Users", value: stats.users, color: "text-neon-green" },
            { icon: Ticket, label: "Tickets", value: stats.tickets, color: "text-neon-cyan" },
            { icon: Activity, label: "Transactions", value: stats.transactions, color: "text-neon-purple" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-5">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList className="glass">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="tickets">Tickets & Pricing</TabsTrigger>
            <TabsTrigger value="verify">Verify Tickets</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="transactions">Audit Log</TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{event.name}</h3>
                  <p className="text-sm text-muted-foreground">{event.venue} · {event.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{event.status}</Badge>
                  <Select value={event.status} onValueChange={(v) => updateEventStatus(event.id, v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => loadTiers(event.id)} className="gap-1">
                    <Edit className="h-3 w-3" /> Tiers
                  </Button>
                </div>
              </div>
            ))}
            {events.length === 0 && <p className="text-center text-muted-foreground py-8">No events yet. Click "Create Event" to add one.</p>}
          </TabsContent>

          {/* Tickets & Pricing Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Search Tickets</h3>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Search by ticket ID or wallet address..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} className="font-mono text-sm" />
                <Button onClick={searchTickets} disabled={ticketSearching} className="gap-1"><Search className="h-4 w-4" /> Search</Button>
              </div>
              {searchedTickets.length > 0 && (
                <div className="space-y-2">
                  {searchedTickets.map((t: any) => (
                    <div key={t.id} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{t.events?.name || "Unknown Event"} — {t.ticket_tiers?.tier_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{t.id}</p>
                        <p className="text-xs text-muted-foreground">Wallet: {t.owner_wallet?.slice(0, 10)}...</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={t.status === "active" ? "bg-neon-green/20 text-neon-green" : ""}>{t.status}</Badge>
                        <span className="text-sm font-mono">{t.ticket_tiers?.price} ETH</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchedTickets.length === 0 && ticketSearch && !ticketSearching && (
                <p className="text-sm text-muted-foreground text-center py-4">No tickets found.</p>
              )}
            </div>

            {/* Manage Tiers per Event */}
            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Manage Ticket Tiers by Event</h3>
              <p className="text-sm text-muted-foreground mb-3">Select an event from the Events tab and click "Tiers" to edit pricing and supply.</p>
              {events.map((event) => (
                <Button key={event.id} variant="outline" size="sm" className="mr-2 mb-2" onClick={() => loadTiers(event.id)}>
                  {event.name}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Verify Tickets Tab */}
          <TabsContent value="verify">
            <div className="glass rounded-xl p-8 max-w-lg mx-auto space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ScanLine className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-center">Check-in Verification</h3>
              <p className="text-muted-foreground text-center text-sm">Scan or paste ticket QR code data to verify and check in</p>
              <div className="space-y-3">
                <Input
                  placeholder='Paste QR data: {"ticketId":"...","secret":"..."}'
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
                  className={`rounded-xl p-6 text-center ${verifyResult.valid ? "bg-neon-green/10 border border-neon-green/30" : "bg-destructive/10 border border-destructive/30"}`}
                >
                  {verifyResult.valid ? <CheckCircle className="h-12 w-12 text-neon-green mx-auto mb-3" /> : <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />}
                  <p className="font-semibold text-lg mb-2">{verifyResult.message}</p>
                  {verifyResult.event && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{verifyResult.event.name}</p>
                      <p>{verifyResult.event.venue}</p>
                      {verifyResult.ticket?.owner_wallet && (
                        <p className="font-mono text-xs">Wallet: {verifyResult.ticket.owner_wallet.slice(0, 6)}...{verifyResult.ticket.owner_wallet.slice(-4)}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.display_name || "Unnamed"}</p>
                  <p className="text-xs font-mono text-muted-foreground">{p.wallet_address}</p>
                </div>
                <div className="flex gap-1">
                  {p.user_roles?.map((r: any) => (
                    <Badge key={r.role} className="bg-primary/20 text-primary">{r.role}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="transactions" className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={tx.tx_type === "purchase" ? "bg-neon-green/20 text-neon-green" : "bg-primary/20 text-primary"}>
                      {tx.tx_type}
                    </Badge>
                    <span className="font-mono text-sm">{tx.price} ETH</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    {tx.from_wallet ? `${tx.from_wallet.slice(0, 8)}...` : "Primary"} → {tx.to_wallet?.slice(0, 8)}...
                  </p>
                </div>
                {tx.tx_hash && <span className="text-xs font-mono text-muted-foreground">{tx.tx_hash.slice(0, 12)}...</span>}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Tier Edit Dialog */}
        <Dialog open={tiersOpen} onOpenChange={setTiersOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Ticket Tiers</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {eventTiers.map((tier) => (
                <div key={tier.id} className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{tier.tier_name}</span>
                    <Badge>{tier.remaining_supply}/{tier.total_supply} left</Badge>
                  </div>
                  {editingTier?.id === tier.id ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Price (ETH)</Label>
                        <Input type="number" value={editingTier.price} onChange={(e) => setEditingTier({ ...editingTier, price: e.target.value })} step="0.001" />
                      </div>
                      <div>
                        <Label className="text-xs">Total Supply</Label>
                        <Input type="number" value={editingTier.total_supply} onChange={(e) => setEditingTier({ ...editingTier, total_supply: e.target.value })} />
                      </div>
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
  );
};

export default AdminPanel;
