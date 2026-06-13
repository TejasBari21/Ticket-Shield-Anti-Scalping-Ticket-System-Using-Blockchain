import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles,
  Loader2, Shield, Users,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { auditLogDB } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";

type Portal = "user" | "admin";
type AuthMode = "login" | "signup";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, signOut } = useAuth();

  // portal: which login form to show
  const [portal, setPortal] = useState<Portal | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handlePortalSelect = (p: Portal) => {
    setPortal(p);
    setMode("login");
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup" && portal !== "admin" && password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const user = await signIn(email.trim(), password.trim());

        if (portal === "admin") {
          if (!user.roles.includes("admin")) {
            // Sign out immediately — non-admin tried to use the admin portal
            await signOut();
            throw new Error("Access denied. This account does not have admin privileges.");
          }
          toast({ title: "Welcome, Admin!", description: "Redirecting to admin panel…" });
          navigate("/admin");
        } else {
          toast({ title: "Welcome back!", description: "You have successfully logged in." });
          navigate("/dashboard");
        }
      } else {
        // signup — only allowed for user portal
        const { user: newUser, needsEmailConfirmation } = await signUp(email, password);
        auditLogDB.log({
          action: "user_registration",
          user_id: newUser.id,
          detail: newUser.email,
        });
        if (needsEmailConfirmation) {
          toast({
            title: "Check your email",
            description: "We sent you a confirmation link. Click it to activate your account, then sign in.",
          });
        } else {
          toast({
            title: "Account created!",
            description: "You are now signed in.",
          });
          navigate("/dashboard");
          return;
        }
        setMode("login");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 selection:bg-[#1BA6A6]/30 relative bg-background overflow-hidden font-sans">
      {/* Subtle Ambient Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] rounded-full bg-[#1BA6A6]/5 blur-[180px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[#7ED4D4]/5 blur-[150px]" />
      </div>
      
      <div className="absolute inset-0 opacity-[0.03] z-0" style={{
        backgroundImage: "radial-gradient(circle, #1F2933 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Main Content */}
      <main className="w-full max-w-[440px] relative z-10 mt-8">
        
        {/* Brand Identity */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 rounded-xl bg-[#1BA6A6] flex items-center justify-center mb-6 shadow-xl shadow-[#1BA6A6]/20 border border-[#1BA6A6]/10">
             <Shield className="text-white h-8 w-8" />
          </div>
          <h1 className="font-extrabold text-4xl tracking-tight text-[#1F2933] mb-2">TicketShield</h1>
          <p className="text-[#6B7280] text-sm font-medium">Secure access to your sovereign digital assets</p>
        </div>

        {/* Login Container */}
        <div className="bg-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-[#E5E7EB]">
          {/* Subtle accent line */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#1BA6A6]/40 to-transparent"></div>

          {/* Form Header for Admin or Mode */}
          <AnimatePresence mode="popLayout">
            {portal === "admin" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 flex items-center gap-2 justify-center bg-amber-50 text-amber-600 border border-amber-100 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest overflow-hidden">
                <Shield className="h-4 w-4" /> Admin Access
              </motion.div>
            )}
            {portal === "user" && mode === "signup" && (
               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 flex items-center gap-2 justify-center bg-[#1BA6A6]/5 text-[#1BA6A6] border border-[#1BA6A6]/10 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest overflow-hidden">
                  <Users className="h-4 w-4" /> Wallet Registration
               </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Input */}
            <div className="space-y-2">
              <Label className="block text-[10px] font-bold text-[#6B7280] px-1 uppercase tracking-widest">Email Address</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                   <Mail className="h-5 w-5 text-[#9CA3AF] group-focus-within:text-[#1BA6A6] transition-colors" />
                </div>
                <Input
                  className="w-full bg-[#F5F7F8] border-[#E5E7EB] rounded-xl py-6 pl-12 pr-4 text-[#1F2933] placeholder:text-[#9CA3AF]/60 focus:ring-2 focus:ring-[#1BA6A6]/10 transition-all font-medium text-base h-14"
                  placeholder={portal === "admin" ? "admin@vault.gov" : "name@vault.com"}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <Label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Security Key</Label>
                {mode === "login" && (
                  <button type="button" onClick={() => toast({ title: "Recovery Unavailable", variant: "destructive"})} className="text-[10px] font-bold text-[#1BA6A6] hover:underline transition-colors uppercase tracking-wider">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#9CA3AF] group-focus-within:text-[#1BA6A6] transition-colors" />
                </div>
                <Input
                  className="w-full bg-[#F5F7F8] border-[#E5E7EB] rounded-xl py-6 pl-12 pr-12 text-[#1F2933] placeholder:text-[#9CA3AF]/60 focus:ring-2 focus:ring-[#1BA6A6]/10 transition-all font-medium tracking-widest text-base h-14"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-4 flex items-center text-[#9CA3AF] hover:text-[#1F2933] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            <AnimatePresence>
              {mode === "signup" && portal !== "admin" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                  <Label className="block text-[10px] font-bold text-[#6B7280] px-1 uppercase tracking-widest mt-2">Verify Key</Label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[#9CA3AF] group-focus-within:text-[#1BA6A6] transition-colors" />
                    </div>
                    <Input
                      className="w-full bg-[#F5F7F8] border-[#E5E7EB] rounded-xl py-6 pl-12 pr-12 text-[#1F2933] placeholder:text-[#9CA3AF]/60 focus:ring-2 focus:ring-[#1BA6A6]/10 transition-all font-medium tracking-widest text-base h-14"
                      placeholder="••••••••••••"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute inset-y-0 right-4 flex items-center text-[#9CA3AF] hover:text-[#1F2933] transition-colors">
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                 portal === "admin" 
                   ? "bg-amber-500 shadow-amber-500/20" 
                   : "bg-[#1BA6A6] shadow-[#1BA6A6]/20"
              }`}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {portal === "admin" ? "Authenticate Admin" : mode === "login" ? "Login Securely" : "Initialize Secure Wallet"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Divider and Toggle */}
            {portal !== "admin" && (
              <>
                <div className="flex items-center gap-4 py-2">
                  <div className="h-[1px] flex-1 bg-[#E5E7EB]"></div>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-[0.2em] font-bold">{mode === "login" ? "Social Protocol" : "Already registered?"}</span>
                  <div className="h-[1px] flex-1 bg-[#E5E7EB]"></div>
                </div>

                <button
                  type="button"
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); resetForm(); }}
                  className="w-full border border-[#E5E7EB] bg-white py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-[#F5F7F8] transition-colors text-[#1F2933] text-sm font-bold group"
                >
                  {mode === "login" ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#1BA6A6] group-hover:scale-110 transition-transform" />
                      <span>Create Sovereign Wallet</span>
                    </>
                  ) : (
                    <span>Sign In Securely</span>
                  )}
                </button>
              </>
            )}
          </form>
        </div>

        {/* Secondary Actions & Metadata */}
        <div className="mt-8 flex flex-col items-center gap-6">
          <button
            onClick={() => {
               if (portal === "user") {
                 setPortal("admin");
               } else {
                 setPortal("user");
                 setMode("login");
               }
               resetForm(); 
            }}
            className="group flex items-center gap-2 text-xs font-bold tracking-wide text-[#6B7280] hover:text-[#1BA6A6] transition-colors"
          >
            {portal === "admin" ? (
              <>
                <Users className="h-4 w-4 text-[#1BA6A6] group-hover:scale-110 transition-transform" />
                Return to User Access
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                Admin / Event Organizer Login
              </>
            )}
          </button>

          {/* Technical Utilities */}
          <div className="flex items-center gap-4 pt-4 border-t border-[#E5E7EB] w-full justify-center">
            <Link to="/" className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#1BA6A6] transition-colors">
              <span className="text-[10px] uppercase tracking-widest font-bold">API Configuration</span>
            </Link>
            <div className="w-1 h-1 rounded-full bg-[#E5E7EB]"></div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#9CA3AF]">System Nominal</span>
            </div>
          </div>
        </div>
      </main>

      {/* Background Decoration */}
      <div className="fixed bottom-0 left-0 p-8 pointer-events-none opacity-5">
        <p className="text-8xl font-black text-[#1F2933] select-none tracking-tighter">VAULT</p>
      </div>
    </div>
  );
};

export default Login;
