import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, ArrowRight, CheckCircle2, FileText, Activity, RefreshCw, Ticket } from "lucide-react";

export default function Index() {
  return (
    <div className="bg-background min-h-screen text-foreground font-body overflow-x-hidden selection:bg-primary/15">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1BA6A6] to-[#7ED4D4] flex items-center justify-center shadow-lg shadow-[#1BA6A6]/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-headline font-bold text-xl tracking-tight text-[#1F2933]">TicketShield</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B7280]">
            <a href="#features" className="hover:text-[#1BA6A6] transition-colors">Features</a>
            <a href="#solutions" className="hover:text-[#1BA6A6] transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-[#1BA6A6] transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-[#6B7280] hover:text-[#1F2933] transition-colors">
              Login
            </Link>
            <Link to="/login" className="px-5 py-2.5 bg-[#1BA6A6] text-white font-bold text-sm rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[#1BA6A6]/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1BA6A6]/10 border border-[#1BA6A6]/20 w-fit">
              <div className="w-2 h-2 rounded-full bg-[#1BA6A6] animate-pulse" />
              <span className="text-[10px] font-bold text-[#1BA6A6] tracking-widest uppercase">Web3 Secured</span>
            </div>
            
            <h1 className="font-headline text-5xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-[#1F2933]">
              The Sovereign <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1BA6A6] to-[#7ED4D4]">Vault of Digital</span><br/>
              Access
            </h1>
            
            <p className="text-lg text-[#6B7280] max-w-lg leading-relaxed font-medium">
              Eliminate fraud, prevent duplicates, and reclaim control of your event ticketing with the power of blockchain verification.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <Link to="/events" className="px-8 py-4 bg-[#1BA6A6] text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-xl shadow-[#1BA6A6]/30">
                Secure Your Event
              </Link>
              <button className="px-8 py-4 bg-white border border-[#E5E7EB] text-[#1F2933] font-bold rounded-xl hover:bg-[#F5F7F8] transition-colors text-sm shadow-sm">
                View Demo
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            {/* Abstract UI Mockup */}
            <div className="relative aspect-square md:aspect-[4/3] rounded-3xl border border-[#E5E7EB] bg-white shadow-2xl flex items-center justify-center p-8">
              <div className="absolute inset-0 bg-[#1BA6A6]/5 blur-3xl rounded-full" />
              
              <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden">
                <div className="h-12 border-b border-[#E5E7EB] bg-[#F5F7F8] flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#E5E7EB]" />
                  <div className="w-3 h-3 rounded-full bg-[#E5E7EB]" />
                  <div className="w-3 h-3 rounded-full bg-[#E5E7EB]" />
                </div>
                <div className="p-6 space-y-4">
                  <div className="w-3/4 h-6 bg-[#F5F7F8] rounded-md" />
                  <div className="w-1/2 h-4 bg-[#F5F7F8] rounded-md" />
                  
                  <div className="pt-6 grid grid-cols-2 gap-4">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-[#1BA6A6]/10 to-[#7ED4D4]/10 border border-[#E5E7EB] flex items-center justify-center">
                      <Ticket className="w-12 h-12 text-[#1BA6A6]/30" />
                    </div>
                    <div className="space-y-3">
                      <div className="w-full h-8 bg-[#F5F7F8] rounded-md" />
                      <div className="w-full h-8 bg-[#F5F7F8] rounded-md" />
                      <div className="w-2/3 h-8 bg-[#F5F7F8] rounded-md" />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[#FACC15]/10 border-t border-[#FACC15]/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FACC15]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[#FACC15]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#FACC15] uppercase font-bold tracking-widest">Secured via</span>
                    <span className="text-sm font-bold text-[#1F2933]">Verified Ledger</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Trusted By Section */}
        <section className="py-12 border-y border-border bg-white">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#9CA3AF] uppercase mb-8 block">Trusted by global event leaders</span>
            <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24 opacity-60">
              {['FESTIV-X', 'STADIA', 'METACON', 'AetherArena', 'BLOCK-TIK'].map((brand) => (
                <span key={brand} className="font-headline font-black text-2xl tracking-tighter text-[#1F2933]">{brand}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-headline text-4xl lg:text-5xl font-bold mb-6 text-[#1F2933]">Unyielding Security</h2>
            <p className="text-[#6B7280] max-w-2xl mx-auto font-medium">
              Built on a foundation of cryptographic proof to ensure every ticket is as unique as the fan holding it.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 hover:shadow-lg transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#1BA6A6]/10 border border-[#1BA6A6]/20 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-[#1BA6A6]" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[#1F2933]">Immutable Verification</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">
                Every ticket is a verified asset on the ledger. Once minted, its ownership history is permanent and unalterable.
              </p>
            </div>
            
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 hover:shadow-lg transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#1BA6A6]/10 border border-[#1BA6A6]/20 flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-[#1BA6A6]" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[#1F2933]">Real-time Fraud Detection</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">
                Instant alerts for duplicate scan attempts and location mismatches. Stop bad actors at the gate before they enter.
              </p>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 hover:shadow-lg transition-all shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#7ED4D4]/10 border border-[#7ED4D4]/20 flex items-center justify-center mb-6">
                <RefreshCw className="w-6 h-6 text-[#1BA6A6]" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[#1F2933]">Seamless Secondary Market</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">
                Control resale prices and eliminate scalping via smart contracts. Set royalty fees for every peer-to-peer transfer.
              </p>
            </div>
          </div>
        </section>

        {/* Organizer Section */}
        <section className="py-32 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-headline text-4xl lg:text-5xl font-bold mb-6 text-[#1F2933]">
              Designed for <br/>
              <span className="text-[#1BA6A6]">High-Stakes Organizers</span>
            </h2>
            <p className="text-[#6B7280] font-medium mb-8 leading-relaxed max-w-md">
              Gain full visibility into your event's health. Monitor entry velocity, identify bot behavior, and watch fraud suppression in real-time from a single command center.
            </p>
            <ul className="space-y-4">
              {['Real-time Entry Velocity Tracking', 'Instant Fraud Suppression Alerts', 'Dynamic Revenue Redistribution'].map((item) => (
                <li key={item} className="flex items-center gap-3 font-medium text-sm text-[#1F2933]">
                  <CheckCircle2 className="w-5 h-5 text-[#1BA6A6]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
             {/* Mock Dashboard UI */}
             <div className="bg-white border border-[#E5E7EB] rounded-3xl shadow-2xl overflow-hidden p-6 max-w-lg mx-auto">
               <div className="flex justify-between items-center mb-8 border-b border-[#E5E7EB] pb-4">
                 <div className="flex gap-2">
                   <div className="w-3 h-3 bg-red-500 rounded-full" />
                   <div className="w-3 h-3 bg-amber-400 rounded-full" />
                   <div className="w-3 h-3 bg-[#1BA6A6] rounded-full" />
                 </div>
                 <div className="flex gap-4 text-[10px] font-bold text-[#9CA3AF] tracking-widest uppercase">
                   <span>Live</span>
                   <span>Data</span>
                   <span>Usage</span>
                   <span>Admin</span>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-[#F5F7F8] border border-[#E5E7EB] p-4 rounded-xl">
                   <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold block mb-2">Entry Velocity</span>
                   <span className="text-2xl font-headline font-bold text-[#1F2933]">142/min</span>
                   <div className="w-full h-1 mt-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                     <div className="h-full bg-[#1BA6A6] w-[70%]" />
                   </div>
                 </div>
                 <div className="bg-[#F5F7F8] border border-[#E5E7EB] p-4 rounded-xl">
                   <span className="text-[10px] text-red-500 uppercase tracking-wider font-bold block mb-2">Supressed Scans</span>
                   <span className="text-2xl font-headline font-bold text-red-500">18</span>
                   <div className="w-full h-1 mt-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                     <div className="h-full bg-red-500 w-[15%]" />
                   </div>
                 </div>
               </div>

               <div className="space-y-2">
                 {[
                   { hash: "0x82...a6c2", status: "VERIFIED" },
                   { hash: "0x11...72f1", status: "VERIFIED" }
                 ].map((tx, i) => (
                   <div key={i} className="flex justify-between items-center bg-[#F5F7F8] border border-[#E5E7EB] p-3 rounded-lg text-xs font-mono">
                     <span className="text-[#6B7280]">SCAN: {tx.hash}</span>
                     <span className="text-[10px] px-2 py-1 bg-[#1BA6A6]/10 text-[#1BA6A6] rounded font-bold">{tx.status}</span>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-32 max-w-4xl mx-auto px-6 text-center">
          <div className="text-[#1BA6A6] text-6xl font-serif mb-8 opacity-30">"</div>
          <h2 className="text-2xl md:text-4xl font-headline font-medium leading-relaxed mb-12 italic text-[#1F2933]">
            Implementing TicketShield wasn't just a technology upgrade; it was an existential shift. For the first time in a decade, we finished an opening night with zero fraudulent entry disputes.
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-[#E5E7EB] shadow-sm">
              <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop" alt="Marcus Thorne" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm text-[#1F2933]">Marcus Thorne</div>
              <div className="text-xs text-[#6B7280]">Director, Global Octaves Music Festival</div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#1BA6A6]" />
              <span className="font-headline font-bold text-lg tracking-tight text-[#1F2933]">TicketShield</span>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed max-w-xs">
              The world's most secure digital ticketing infrastructure. Powered by Ethereum and protected by Aether Shield technology.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#1F2933] mb-6">Platform</h4>
            <ul className="space-y-4 text-sm text-[#6B7280] font-medium">
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">Ledger Stats</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#1F2933] mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-[#6B7280] font-medium">
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">About</a></li>
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-[#1BA6A6] transition-colors">Partners</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-[#E5E7EB] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-[#9CA3AF] font-medium tracking-wide">
            © 2026 TICKETSHIELD INC. <span className="mx-2">·</span> PRIVACY <span className="mx-2">·</span> TERMS
          </p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1BA6A6]/20 bg-[#1BA6A6]/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1BA6A6]" />
            <span className="text-[10px] font-bold text-[#1BA6A6] uppercase tracking-widest">System Info Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
