import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, MapPin, Navigation } from "lucide-react";
import {
  Button, Input, Textarea, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch,
} from "@/components/ui"
import { localDB } from "@/lib/localDB";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { createEvent as createEventOnChain, initializeContract } from "@/integrations/contracts/contractService";

const CONTRACT_ADDRESS = (import.meta.env as Record<string, string>).VITE_CONTRACT_ADDRESS;

interface TierForm {
  tier_name: string;
  price: string;
  total_supply: string;
  max_per_wallet: string;
}

const CreateEvent = () => {
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editId);
  const navigate = useNavigate();
  const { userId, isConnected, address } = useWallet();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    date: "",
    end_date: "",
    venue: "",
    location: "",
    image_url: "",
    category: "general",
    resale_enabled: true,
    resale_price_cap_percent: "100",
    venue_lat: "",
    venue_lng: "",
    geo_radius_m: "300",
  });

  const [geoLocating, setGeoLocating] = useState(false);

  // Pre-populate form when editing an existing event
  useEffect(() => {
    if (!editId) return;
    const evt = localDB.getEvent(editId);
    if (!evt) return;
    setForm({
      name: evt.name,
      description: evt.description ?? "",
      date: evt.date ? new Date(evt.date).toISOString().slice(0, 16) : "",
      end_date: evt.end_date ? new Date(evt.end_date).toISOString().slice(0, 16) : "",
      venue: evt.venue,
      location: evt.location ?? "",
      image_url: evt.image_url ?? "",
      category: evt.category,
      resale_enabled: evt.resale_enabled,
      resale_price_cap_percent: String(evt.resale_price_cap_percent),
      venue_lat: evt.venue_lat != null ? String(evt.venue_lat) : "",
      venue_lng: evt.venue_lng != null ? String(evt.venue_lng) : "",
      geo_radius_m: evt.geo_radius_m != null ? String(evt.geo_radius_m) : "300",
    });
    if (evt.ticket_tiers?.length) {
      setTiers(evt.ticket_tiers.map((t) => ({
        tier_name: t.tier_name,
        price: String(t.price),
        total_supply: String(t.total_supply),
        max_per_wallet: String(t.max_per_wallet),
      })));
    }
  }, [editId]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          venue_lat: pos.coords.latitude.toFixed(7),
          venue_lng: pos.coords.longitude.toFixed(7),
        }));
        setGeoLocating(false);
        toast({ title: "Location captured", description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      (err) => {
        setGeoLocating(false);
        toast({ title: "Location error", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const [tiers, setTiers] = useState<TierForm[]>([
    { tier_name: "General Admission", price: "0.01", total_supply: "100", max_per_wallet: "4" },
  ]);

  const addTier = () => setTiers([...tiers, { tier_name: "", price: "0", total_supply: "50", max_per_wallet: "4" }]);
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof TierForm, value: string) => {
    const updated = [...tiers];
    updated[i][field] = value;
    setTiers(updated);
  };

  const handleSubmit = async (status: "draft" | "published") => {
    if (!userId || !form.name || !form.date || !form.venue) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const tierData = tiers.filter(t => t.tier_name).map(t => ({
      tier_name: t.tier_name,
      price: parseFloat(t.price) || 0,
      total_supply: parseInt(t.total_supply) || 100,
      remaining_supply: parseInt(t.total_supply) || 100,
      max_per_wallet: parseInt(t.max_per_wallet) || 4,
    }));
    const eventData = {
      organizer_id: userId!,
      name: form.name,
      description: form.description || null,
      date: new Date(form.date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      venue: form.venue,
      location: form.location || null,
      image_url: form.image_url || null,
      category: form.category,
      status,
      resale_enabled: form.resale_enabled,
      resale_price_cap_percent: parseInt(form.resale_price_cap_percent) || 100,
      ...(form.venue_lat && form.venue_lng ? {
        venue_lat: parseFloat(form.venue_lat),
        venue_lng: parseFloat(form.venue_lng),
        geo_radius_m: parseInt(form.geo_radius_m) || 300,
      } : {}),
    };

    try {
      const existingEvent = isEditMode && editId ? localDB.getEvent(editId) : null;
      const existingContractEventId = existingEvent?.contract_event_id;
      const mustRegisterForPublish = status === "published" && !existingContractEventId;
      const shouldRegisterOnChain = Boolean(
        address &&
        isConnected &&
        (
          !isEditMode ||
          mustRegisterForPublish
        )
      );

      if (status === "published" && !shouldRegisterOnChain) {
        throw new Error("Publishing requires on-chain registration. Connect organizer wallet and try again.");
      }

      const eventStartMs = new Date(form.date).getTime();
      if (!Number.isFinite(eventStartMs) || eventStartMs <= Date.now() + 30_000) {
        throw new Error("Event date must be at least 30 seconds in the future.");
      }

      // ── Step 1: Register on blockchain (when needed) ──────────
      let contract_event_id: number | undefined = existingContractEventId;
      if (shouldRegisterOnChain) {
        try {
          await initializeContract(CONTRACT_ADDRESS, address);
          const basePrice = tierData[0]?.price?.toString() || "0";
          const totalCapacity = tierData.reduce((s, t) => s + t.total_supply, 0);
          const capPercent = parseInt(form.resale_price_cap_percent) || 100;
          const maxResalePrice = form.resale_enabled
            ? ((parseFloat(basePrice) * capPercent) / 100).toFixed(6)
            : "0";
          const { contractEventId } = await createEventOnChain(
            form.name,
            form.description || "",
            eventStartMs,
            form.location || form.venue,
            totalCapacity,
            basePrice,
            maxResalePrice,
          );
          contract_event_id = contractEventId;
          toast({ title: "Registered on Blockchain ✅", description: `Contract event ID: ${contractEventId}` });
        } catch (chainErr: unknown) {
          const msg = chainErr instanceof Error ? chainErr.message : "Failed to register event on-chain";
          if (status === "published") {
            throw new Error(msg);
          }
          toast({
            title: "On-Chain Registration Skipped ⚠️",
            description: "Draft saved locally. Publish later after wallet-based blockchain registration succeeds.",
            variant: "destructive",
          });
        }
      }

      // ── Step 2: Persist locally ──────────────────────────────────────────
      if (isEditMode && editId) {
        localDB.updateEvent(editId, { ...eventData, contract_event_id }, tierData);
        toast({ title: "Event Updated! ✅", description: status === "published" ? "Your event is now live." : "Saved as draft." });
      } else {
        localDB.createEvent({ ...eventData, contract_event_id }, tierData);
        toast({ title: "Event Created! 🎉", description: status === "published" ? "Your event is now live." : "Saved as draft." });
      }
      navigate("/organizer");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 bg-background min-h-screen">
        <h2 className="text-2xl font-bold text-[#1F2933]">Connect your wallet first</h2>
        <Button onClick={() => navigate("/login")} className="mt-4 bg-[#1BA6A6] text-white">Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto bg-background min-h-screen text-foreground font-body">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/organizer")} className="mb-6 gap-2 text-[#6B7280] hover:text-[#1F2933]">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <h1 className="text-3xl font-extrabold mb-4 text-[#1F2933]">{isEditMode ? "Edit Event" : "Create Event"}</h1>

        {/* Blockchain wallet warning */}
        {!isConnected && !isEditMode && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="w-5 h-5 mt-0.5 shrink-0 text-red-500">⚠️</div>
            <div>
              <p className="text-sm font-bold text-red-600">Wallet Not Connected</p>
              <p className="text-xs text-red-500/80 mt-0.5 font-medium">
                Connect MetaMask before publishing so the event is registered on the blockchain.
                Without it, ticket purchases will fail until an admin registers it manually.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-[#1F2933]">Event Details</h2>
            <div>
              <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Event Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Amazing Event" className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell people about your event..." className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" rows={4} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Start Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
              </div>
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Sales End Date (optional)</Label>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Venue *</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Madison Square Garden" className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
              </div>
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="New York, NY" className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="art">Art</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]" />
              </div>
            </div>
          </div>

          {/* Ticket Tiers */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1F2933]">Ticket Tiers</h2>
              <Button variant="outline" size="sm" onClick={addTier} className="gap-1 border-[#E5E7EB] font-bold"><Plus className="h-3 w-3" /> Add Tier</Button>
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="bg-[#F5F7F8] rounded-xl p-4 space-y-3 border border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1F2933]">Tier {i + 1}</span>
                  {tiers.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeTier(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Tier Name</Label>
                    <Input value={tier.tier_name} onChange={(e) => updateTier(i, "tier_name", e.target.value)} placeholder="e.g. VIP, General" className="mt-1 bg-white border-[#E5E7EB]" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Price (ETH)</Label>
                    <Input type="number" value={tier.price} onChange={(e) => updateTier(i, "price", e.target.value)} step="0.001" min="0" placeholder="0.01" className="mt-1 bg-white border-[#E5E7EB]" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Total Supply</Label>
                    <Input type="number" value={tier.total_supply} onChange={(e) => updateTier(i, "total_supply", e.target.value)} min="1" placeholder="100" className="mt-1 bg-white border-[#E5E7EB]" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Max Per Wallet</Label>
                    <Input type="number" value={tier.max_per_wallet} onChange={(e) => updateTier(i, "max_per_wallet", e.target.value)} min="1" placeholder="4" className="mt-1 bg-white border-[#E5E7EB]" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Geo-lock Settings */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-[#1F2933]">
                  <MapPin className="h-4 w-4 text-[#1BA6A6]" /> Geo-lock Activation
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5 font-medium">Ticket QR codes only activate within range of the venue</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-bold border-[#E5E7EB]"
                onClick={handleUseMyLocation}
                disabled={geoLocating}
              >
                <Navigation className="h-3.5 w-3.5" />
                {geoLocating ? "Locating…" : "Use My Location"}
              </Button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Latitude</Label>
                <Input
                  value={form.venue_lat}
                  onChange={(e) => setForm({ ...form, venue_lat: e.target.value })}
                  placeholder="e.g. 28.6139"
                  className="mt-1 font-mono text-sm bg-[#F5F7F8] border-[#E5E7EB]"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Longitude</Label>
                <Input
                  value={form.venue_lng}
                  onChange={(e) => setForm({ ...form, venue_lng: e.target.value })}
                  placeholder="e.g. 77.2090"
                  className="mt-1 font-mono text-sm bg-[#F5F7F8] border-[#E5E7EB]"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Radius (m)</Label>
                <Input
                  type="number"
                  value={form.geo_radius_m}
                  onChange={(e) => setForm({ ...form, geo_radius_m: e.target.value })}
                  placeholder="300"
                  min="50"
                  className="mt-1 bg-[#F5F7F8] border-[#E5E7EB]"
                />
              </div>
            </div>
            {form.venue_lat && form.venue_lng && (
              <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Geo-lock set · tickets unlock within {form.geo_radius_m || 300}m of venue
              </p>
            )}
          </div>

          {/* Resale Settings */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-[#1F2933]">Resale Settings</h2>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-[#1F2933]">Enable Secondary Market</Label>
              <Switch checked={form.resale_enabled} onCheckedChange={(v) => setForm({ ...form, resale_enabled: v })} />
            </div>
            {form.resale_enabled && (
              <div>
                <Label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Max Resale Price (% of face value)</Label>
                <Input type="number" value={form.resale_price_cap_percent} onChange={(e) => setForm({ ...form, resale_price_cap_percent: e.target.value })} className="mt-1 w-32 bg-[#F5F7F8] border-[#E5E7EB]" max="200" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-[#E5E7EB] font-bold text-[#6B7280]" onClick={() => handleSubmit("draft")} disabled={saving}>
              Save as Draft
            </Button>
            <Button
              className="flex-1 bg-[#1BA6A6] text-white font-bold shadow-lg shadow-[#1BA6A6]/20"
              onClick={() => handleSubmit("published")}
              disabled={saving}
              title={!isConnected ? "Connect MetaMask wallet first for on-chain registration" : undefined}
            >
              {saving ? "Publishing..." : isConnected ? "Publish Event" : "Publish (No Wallet)"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateEvent;
