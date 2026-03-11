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
  const { signIn, signUp } = useAuth();

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

    if (mode === "signup" && password !== confirmPassword) {
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
            await import("@/integrations/supabase/client").then(({ supabase }) =>
              supabase.auth.signOut()
            );
            throw new Error("Access denied. This account does not have admin privileges.");
          }
          toast({ title: "Welcome, Admin!", description: "Redirecting to admin panel…" });
          navigate("/admin");
        } else {
          toast({ title: "Welcome back!", description: "You have successfully logged in." });
          navigate("/events");
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
          navigate("/events");
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] rounded-full bg-primary/6 blur-[150px] animate-float" />
        <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-neon-pink/5 blur-[130px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-[55%] left-[50%] w-[300px] h-[300px] rounded-full bg-neon-cyan/4 blur-[120px] animate-float" style={{ animationDelay: "1.5s" }} />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div className={`relative z-10 w-full mx-auto px-6 transition-all duration-300 ${portal ? "max-w-md" : "max-w-xl"}`}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl gradient-primary-static flex items-center justify-center shadow-xl shadow-primary/30">
              <span className="text-white font-bold text-base tracking-tight">FP</span>
            </div>
            <span className="text-2xl font-bold gradient-text">FairPass</span>
          </Link>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Web3 Ticketing Platform</span>
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Portal selector ── */}
          {!portal && (
            <motion.div
              key="portal-select"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35 }}
            >
              <h2 className="text-center text-2xl font-extrabold mb-2 gradient-text">Select Portal</h2>
              <p className="text-center text-sm text-muted-foreground mb-8">Choose how you want to access FairPass</p>

              <div className="grid grid-cols-2 gap-5">
                {/* User */}
                <button
                  onClick={() => handlePortalSelect("user")}
                  className="glass rounded-2xl p-8 border border-white/[0.06] hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 group text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-1.5">User</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Browse events &amp; buy tickets</p>
                  <div className="flex items-center gap-1.5 mt-6 text-primary text-sm font-semibold">
                    Enter <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Admin */}
                <button
                  onClick={() => handlePortalSelect("admin")}
                  className="glass rounded-2xl p-8 border border-white/[0.06] hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-300 group text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 group-hover:border-amber-500/40 transition-all">
                    <Shield className="h-7 w-7 text-amber-400" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-1.5">Admin</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Manage events &amp; platform</p>
                  <div className="flex items-center gap-1.5 mt-6 text-amber-400 text-sm font-semibold">
                    Enter <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Login / Signup form ── */}
          {portal && (
            <motion.div
              key={`form-${portal}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35 }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${
                  portal === "admin"
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-primary/10 border border-primary/20"
                }`}>
                  {portal === "admin"
                    ? <Shield className="h-7 w-7 text-amber-400" />
                    : <Users className="h-7 w-7 text-primary" />
                  }
                </div>
                <h1 className={`text-2xl font-extrabold mb-1 ${portal === "admin" ? "text-amber-400" : "gradient-text"}`}>
                  {portal === "admin" ? "Admin Portal" : mode === "login" ? "Welcome Back" : "Create Account"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {portal === "admin"
                    ? "Sign in with your admin credentials"
                    : mode === "login"
                    ? "Sign in to access your tickets"
                    : "Join FairPass today"}
                </p>
              </div>

              {/* Card */}
              <div className="glass rounded-2xl border border-white/[0.08] p-7 shadow-2xl shadow-black/20">
                {/* Sign In / Sign Up toggle (user only) */}
                {portal === "user" && (
                  <div className="flex rounded-xl overflow-hidden border border-white/[0.08] mb-6 bg-white/[0.02]">
                    {(["login", "signup"] as AuthMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => { setMode(m); resetForm(); }}
                        className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
                          mode === m
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "login" ? "Sign In" : "Sign Up"}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm text-muted-foreground">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder={portal === "admin" ? "admin@example.com" : "you@example.com"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 bg-white/[0.03] border-white/[0.08] focus:border-primary/50 h-11"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10 pr-10 bg-white/[0.03] border-white/[0.08] focus:border-primary/50 h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (user signup only) */}
                  {portal === "user" && mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="pl-10 pr-10 bg-white/[0.03] border-white/[0.08] focus:border-primary/50 h-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showConfirmPassword ? "Hide" : "Show"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Forgot password (login mode) */}
                  {mode === "login" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          toast({ title: "Password reset not available", description: "Please contact support to reset your password.", variant: "destructive" });
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-11 gap-2 text-sm font-semibold ${
                      portal === "admin"
                        ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
                        : "btn-primary"
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {portal === "admin" ? "Sign In as Admin" : mode === "login" ? "Sign In" : "Create Account"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Switch mode footer (user only) */}
                {portal === "user" && (
                  <>
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                      <button
                        type="button"
                        onClick={() => { setMode(mode === "login" ? "signup" : "login"); resetForm(); }}
                        className="text-primary font-medium hover:underline"
                      >
                        {mode === "login" ? "Sign up" : "Sign in"}
                      </button>
                    </p>
                  </>
                )}
              </div>

              {/* Back to portal selector */}
              <button
                type="button"
                onClick={() => { setPortal(null); resetForm(); }}
                className="block text-center w-full mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to portal selection
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to landing */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-6">
          <Link to="/" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            ← Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

