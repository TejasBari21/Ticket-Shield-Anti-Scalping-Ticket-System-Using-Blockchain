import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Users, Ticket, Calendar, Activity, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminPanel = () => {
  const { isConnected, hasRole, userId } = useWallet();
  const { toast } = useToast();
  const [stats, setStats] = useState({ events: 0, tickets: 0, users: 0, transactions: 0 });
  const [profiles, setProfiles] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const updateEventStatus = async (eventId: string, status: string) => {
    await supabase.from("events").update({ status: status as any }).eq("id", eventId);
    toast({ title: `Event ${status}` });
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents(data || []);
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
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground mb-8">Platform management and monitoring</p>

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
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="transactions">Audit Log</TabsTrigger>
          </TabsList>

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
                </div>
              </div>
            ))}
          </TabsContent>

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
      </motion.div>
    </div>
  );
};

export default AdminPanel;
