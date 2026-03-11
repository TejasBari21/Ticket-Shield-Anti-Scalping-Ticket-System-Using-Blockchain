import { motion } from "framer-motion";
import { Wallet, Search, Ticket, Shield, ArrowRight, Zap, Lock, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Lock,
    title: "Anti-Scalping",
    description: "Smart contracts enforce fair pricing with resale price caps set by organizers.",
    color: "from-violet-500/20 to-purple-600/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Zap,
    title: "Instant Verification",
    description: "Time-locked QR codes activate hours before the event for secure check-in.",
    color: "from-amber-500/20 to-orange-600/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Users,
    title: "Fair Access",
    description: "Per-wallet purchase limits prevent bulk buying and bot activity.",
    color: "from-cyan-500/20 to-blue-600/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Shield,
    title: "Blockchain Secured",
    description: "Every ticket is an NFT with immutable ownership records on-chain.",
    color: "from-emerald-500/20 to-green-600/20",
    iconColor: "text-emerald-400",
  },
];

const steps = [
  { num: "01", icon: Wallet, title: "Connect Wallet", desc: "Link your MetaMask wallet to get started" },
  { num: "02", icon: Search, title: "Browse Events", desc: "Discover concerts, sports, and more" },
  { num: "03", icon: Ticket, title: "Buy Tickets", desc: "Purchase NFT tickets at fair prices" },
];

const Index = () => {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[150px] animate-float" />
          <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-neon-pink/6 blur-[130px] animate-float" style={{ animationDelay: "3s" }} />
          <div className="absolute top-[50%] left-[55%] w-[300px] h-[300px] rounded-full bg-neon-cyan/5 blur-[120px] animate-float" style={{ animationDelay: "1.5s" }} />
        </div>

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2.5 glass rounded-full px-5 py-2 mb-10 text-sm text-muted-foreground"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Powered by Ethereum Smart Contracts</span>
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            </motion.div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-extrabold leading-[1.05] mb-8 tracking-tight">
              <span className="gradient-text">Fair Tickets.</span>
              <br />
              <span className="text-foreground">No Scalpers.</span>
            </h1>

            {/* Subline */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              The Web3 ticketing platform where smart contracts enforce fair pricing and
              every ticket is secured on the blockchain.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="btn-primary text-lg px-10 h-14 gap-3 rounded-xl w-full sm:w-auto">
                <Link to="/login">
                  Get Started
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="btn-outline-glow text-lg px-10 h-14 rounded-xl w-full sm:w-auto">
                <Link to="/events">Explore Events</Link>
              </Button>
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap justify-center gap-8 sm:gap-16 mt-16 pt-8 border-t border-white/[0.06]"
            >
              {[
                { value: "100%", label: "Fair Pricing" },
                { value: "NFT", label: "Backed Tickets" },
                { value: "0%", label: "Scalper Success" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-padding relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Simple & Secure</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">Three simple steps to fair ticketing</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative glass-hover rounded-2xl p-8 text-center group"
              >
                <span className="text-7xl font-extrabold text-white/[0.03] absolute top-3 right-4 font-mono select-none">
                  {step.num}
                </span>
                <div className="w-14 h-14 rounded-xl gradient-primary-static flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.015] to-transparent" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Why Choose Us</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4">Why FairPass?</h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">Built for fans, not bots</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-hover rounded-2xl p-6 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 opacity-[0.06]">
              <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary blur-[100px]" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-neon-pink blur-[100px]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Ready to Experience Fair Ticketing?</h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
                Join thousands of fans who trust blockchain-secured tickets.
              </p>
              <Button asChild size="lg" className="btn-primary text-lg px-10 h-14 gap-3 rounded-xl">
                <Link to="/login">
                  <Wallet className="h-5 w-5" />
                  Get Started
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md gradient-primary-static flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">FP</span>
            </div>
            <span className="font-semibold gradient-text">FairPass</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 FairPass. Decentralized ticketing for everyone.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
