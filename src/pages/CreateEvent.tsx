import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

interface TierForm {
  tier_name: string;
  price: string;
  total_supply: string;
  max_per_wallet: string;
}

const CreateEvent = () => {
  const navigate = useNavigate();
  const { userId, isConnected } = useWallet();
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
  });

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
    try {
      const { data: event, error: eventError } = await supabase.from("events").insert({
        organizer_id: userId,
        name: form.name,
        description: form.description || null,
        date: new Date(form.date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        venue: form.venue,
        location: form.location || null,
        image_url: form.image_url || null,
        category: form.category,
        status: status,
        resale_enabled: form.resale_enabled,
        resale_price_cap_percent: parseInt(form.resale_price_cap_percent) || 100,
      }).select().single();

      if (eventError) throw eventError;

      // Create tiers
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

      toast({ title: "Event Created! 🎉", description: status === "published" ? "Your event is now live." : "Saved as draft." });
      navigate("/organizer");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return <div className="p-6 text-center py-20"><h2 className="text-2xl font-bold">Connect your wallet first</h2></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/organizer")} className="mb-6 gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold mb-8">Create Event</h1>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Event Details</h2>
            <div>
              <Label>Event Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Amazing Event" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell people about your event..." className="mt-1" rows={4} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>End Date & Time</Label>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Venue *</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Madison Square Garden" className="mt-1" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="New York, NY" className="mt-1" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
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
              <div>
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="mt-1" />
              </div>
            </div>
          </div>

          {/* Ticket Tiers */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ticket Tiers</h2>
              <Button variant="outline" size="sm" onClick={addTier} className="gap-1"><Plus className="h-3 w-3" /> Add Tier</Button>
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tier {i + 1}</span>
                  {tiers.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTier(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tier Name</Label>
                    <Input value={tier.tier_name} onChange={(e) => updateTier(i, "tier_name", e.target.value)} placeholder="e.g. VIP, General" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (ETH)</Label>
                    <Input type="number" value={tier.price} onChange={(e) => updateTier(i, "price", e.target.value)} step="0.001" min="0" placeholder="0.01" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Supply</Label>
                    <Input type="number" value={tier.total_supply} onChange={(e) => updateTier(i, "total_supply", e.target.value)} min="1" placeholder="100" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Per Wallet</Label>
                    <Input type="number" value={tier.max_per_wallet} onChange={(e) => updateTier(i, "max_per_wallet", e.target.value)} min="1" placeholder="4" className="mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resale Settings */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Resale Settings</h2>
            <div className="flex items-center justify-between">
              <Label>Enable Resale</Label>
              <Switch checked={form.resale_enabled} onCheckedChange={(v) => setForm({ ...form, resale_enabled: v })} />
            </div>
            {form.resale_enabled && (
              <div>
                <Label>Max Resale Price (% of face value)</Label>
                <Input type="number" value={form.resale_price_cap_percent} onChange={(e) => setForm({ ...form, resale_price_cap_percent: e.target.value })} className="mt-1 w-32" max="200" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => handleSubmit("draft")} disabled={saving}>
              Save as Draft
            </Button>
            <Button className="flex-1 gradient-primary hover:opacity-90" onClick={() => handleSubmit("published")} disabled={saving}>
              {saving ? "Creating..." : "Publish Event"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateEvent;
