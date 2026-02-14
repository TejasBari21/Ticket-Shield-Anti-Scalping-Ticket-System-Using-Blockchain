import { motion } from "framer-motion";
import { Wallet, Search, Ticket, Shield, ArrowRight, Zap, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Lock,
    title: "Anti-Scalping",
    description: "Smart contracts enforce fair pricing with resale price caps set by organizers.",
  },
  {
    icon: Zap,
    title: "Instant Verification",
    description: "Time-locked QR codes activate hours before the event for secure check-in.",
  },
  {
    icon: Users,
    title: "Fair Access",
    description: "Per-wallet purchase limits prevent bulk buying and bot activity.",
  },
  {
    icon: Shield,
    title: "Blockchain Secured",
    description: "Every ticket is an NFT with immutable ownership records on-chain.",
  },
];

const steps = [
  { num: "01", icon: Wallet, title: "Connect Wallet", desc: "Link your MetaMask wallet to get started" },
  { num: "02", icon: Search, title: "Browse Events", desc: "Discover concerts, sports, and more" },
  { num: "03", icon: Ticket, title: "Buy Tickets", desc: "Purchase NFT tickets at fair prices" },
];

const Index = () => {
  const { connectWallet, isConnected, isConnecting } = useWallet();

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-secondary/10 blur-[120px] animate-float" style={{ animationDelay: "3s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-neon-cyan/5 blur-[100px] animate-float" style={{ animationDelay: "1.5s" }} />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              Powered by Ethereum
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6">
              <span className="gradient-text">Fair Tickets.</span>
              <br />
              <span className="text-foreground">No Scalpers.</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
              The Web3 ticketing platform where smart contracts enforce fair pricing and
              every ticket is secured on the blockchain.
            </p>

            <div className="flex flex-wrap gap-4">
              {!isConnected ? (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  size="lg"
                  className="gradient-primary hover:opacity-90 neon-glow text-lg px-8 h-14 gap-2"
                >
                  <Wallet className="h-5 w-5" />
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              ) : (
                <Button asChild size="lg" className="gradient-primary hover:opacity-90 neon-glow text-lg px-8 h-14 gap-2">
                  <Link to="/events">
                    Browse Events
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="glass border-border/50 text-lg px-8 h-14">
                <Link to="/events">Explore Events</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three simple steps to fair ticketing</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative glass rounded-2xl p-8 text-center group hover:border-primary/30 transition-colors"
              >
                <span className="text-6xl font-bold text-primary/10 absolute top-4 right-4 font-mono">
                  {step.num}
                </span>
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-5 group-hover:neon-glow transition-shadow">
                  <step.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why BlockTix?</h2>
            <p className="text-muted-foreground text-lg">Built for fans, not bots</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 group hover:border-primary/30 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 gradient-primary opacity-5" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Experience Fair Ticketing?</h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                Join thousands of fans who trust blockchain-secured tickets.
              </p>
              {!isConnected ? (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  size="lg"
                  className="gradient-primary hover:opacity-90 neon-glow text-lg px-10 h-14 gap-2"
                >
                  <Wallet className="h-5 w-5" />
                  Get Started
                </Button>
              ) : (
                <Button asChild size="lg" className="gradient-primary hover:opacity-90 neon-glow text-lg px-10 h-14 gap-2">
                  <Link to="/events">
                    Browse Events <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">BT</span>
            </div>
            <span className="font-semibold gradient-text">BlockTix</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 BlockTix. Decentralized ticketing for everyone.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
