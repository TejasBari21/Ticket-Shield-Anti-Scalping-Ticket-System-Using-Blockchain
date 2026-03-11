import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  ShieldX,
  User,
  FileText,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Lock,
} from "lucide-react";
import {
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge, Separator,
} from "@/components/ui";
import { useWallet } from "@/contexts/WalletContext";
import { useKYC } from "@/hooks/useKYC";
import { useToast } from "@/hooks/use-toast";
import { auditLogDB } from "@/lib/localDB";
import KYCStatusBadge from "@/components/KYCStatusBadge";
import { format } from "date-fns";

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "India", "Japan", "Singapore", "UAE", "Brazil", "Mexico",
  "Netherlands", "Sweden", "Switzerland", "South Korea", "New Zealand",
  "Other",
];

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "national_id", label: "National ID Card" },
];

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "ID Document", icon: FileText },
  { id: 3, title: "Confirm", icon: CheckCircle },
];

const KYCVerification = () => {
  const { isConnected, address, connectWallet, userId } = useWallet();
  const { kycStatus, submission, loading, submitKYC } = useKYC();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    country: "",
    idType: "",
    idNumber: "",
  });

  const set = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const canProceedStep1 =
    form.fullName.trim().length >= 2 &&
    form.dateOfBirth &&
    form.country;

  const canProceedStep2 =
    form.idType && form.idNumber.trim().length >= 4;

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await submitKYC(form);
    setSubmitting(false);
    if (error) {
      toast({ title: "Submission Failed", description: error, variant: "destructive" });
    } else {
      auditLogDB.log({
        action: "kyc_submitted",
        wallet: address ?? undefined,
        user_id: userId ?? undefined,
        detail: `${form.fullName} · ${form.idType} · ${form.country}`,
      });
      toast({ title: "Identity Verified! ✅", description: "KYC approved. Redirecting to events…" });
      setTimeout(() => navigate("/events"), 1500);
    }
  };

  if (!userId) {
    return (
      <div className="p-6 text-center py-20 max-w-md mx-auto">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
        <p className="text-muted-foreground mb-6">
          Please sign in with your email to access KYC verification.
        </p>
        <Button className="gradient-primary" onClick={() => window.location.href = "/login"}>
          Go to Login
        </Button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-6 text-center py-20 max-w-md mx-auto">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-muted-foreground mb-6">
          You need to connect your MetaMask wallet to start identity verification.
        </p>
        <Button className="gradient-primary" onClick={connectWallet}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              Identity Verification
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-1">KYC Verification</h1>
          <p className="text-muted-foreground">
            Verify your identity to access KYC-gated events. Your data is
            processed securely — sensitive fields are hashed before storage.
          </p>
        </div>

        {/* Current Status Card */}
        <div className="glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Verification Status</h2>
            <KYCStatusBadge status={kycStatus} />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Lock className="h-3.5 w-3.5" />
            <span className="font-mono truncate">{address}</span>
          </div>

          {/* Status Detail */}
          {kycStatus === "approved" && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400">Identity Verified</p>
                <p className="text-sm text-muted-foreground">
                  Your identity has been verified. You have full access to all events.
                </p>
              </div>
            </div>
          )}

          {kycStatus === "pending" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-400">Under Review</p>
                <p className="text-sm text-muted-foreground">
                  Your submission is being reviewed. Typically completed within 24 hours.
                </p>
                {submission && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          )}

          {kycStatus === "rejected" && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <ShieldX className="h-8 w-8 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-semibold text-destructive">Verification Rejected</p>
                  {submission?.rejection_reason && (
                    <p className="text-sm text-muted-foreground">
                      Reason: {submission.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                You may resubmit with corrected information below.
              </p>
            </div>
          )}

          {kycStatus === "unverified" && (
            <div className="bg-muted/20 border border-muted/40 rounded-xl p-4 flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="font-semibold">Not Yet Verified</p>
                <p className="text-sm text-muted-foreground">
                  Complete the form below to verify your identity.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Show form only if not approved or pending */}
        {kycStatus !== "approved" && kycStatus !== "pending" && (
          <div className="glass rounded-2xl p-8">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {STEPS.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      step === s.id
                        ? "bg-primary text-primary-foreground"
                        : step > s.id
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${
                      step === s.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {s.title}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 mx-1" />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ── Step 1: Personal Info ──────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-1">Personal Information</h2>
                    <p className="text-sm text-muted-foreground">
                      Enter your legal full name as it appears on your ID document.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fullName">Full Legal Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Michael Smith"
                      value={form.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => set("dateOfBirth", e.target.value)}
                      max={new Date(
                        new Date().setFullYear(new Date().getFullYear() - 18),
                      )
                        .toISOString()
                        .split("T")[0]}
                    />
                    <p className="text-xs text-muted-foreground">Must be 18 or older</p>
                  </div>

                  <div className="space-y-1">
                    <Label>Country of Residence *</Label>
                    <Select value={form.country} onValueChange={(v) => set("country", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country…" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full gradient-primary"
                    disabled={!canProceedStep1}
                    onClick={() => setStep(2)}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </motion.div>
              )}

              {/* ── Step 2: ID Document ────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-1">ID Document</h2>
                    <p className="text-sm text-muted-foreground">
                      Your document number is{" "}
                      <span className="text-emerald-400 font-medium">
                        hashed (SHA-256) in your browser
                      </span>{" "}
                      before being sent — the raw number never leaves your device.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label>Document Type *</Label>
                    <Select value={form.idType} onValueChange={(v) => set("idType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ID_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="idNumber">Document Number *</Label>
                    <Input
                      id="idNumber"
                      placeholder="e.g. A12345678"
                      value={form.idNumber}
                      onChange={(e) => set("idNumber", e.target.value)}
                      autoComplete="off"
                    />
                    <div className="flex items-center gap-1.5 mt-1">
                      <Lock className="h-3 w-3 text-emerald-400" />
                      <p className="text-xs text-emerald-400">
                        Hashed locally — raw number is never transmitted
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button
                      className="flex-1 gradient-primary"
                      disabled={!canProceedStep2}
                      onClick={() => setStep(3)}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Confirm ────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-xl font-bold mb-1">Confirm & Submit</h2>
                    <p className="text-sm text-muted-foreground">
                      Review your details before submitting — you cannot edit after submission.
                    </p>
                  </div>

                  <div className="bg-muted/20 rounded-xl border border-muted/40 divide-y divide-muted/30">
                    {[
                      { label: "Full Name", value: form.fullName },
                      { label: "Date of Birth", value: form.dateOfBirth },
                      { label: "Country", value: form.country },
                      {
                        label: "ID Type",
                        value:
                          ID_TYPES.find((t) => t.value === form.idType)?.label ||
                          form.idType,
                      },
                      {
                        label: "Document Number",
                        value: `${form.idNumber.slice(0, 3)}${"•".repeat(
                          Math.max(0, form.idNumber.length - 3),
                        )} (hashed)`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Privacy notice */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Privacy Notice</p>
                    <p>
                      Your document number is hashed (SHA-256) in your browser before
                      being stored. FairPass only retains the hash — the original number
                      cannot be recovered from it.
                    </p>
                    <p>
                      Personal information is used solely for identity verification and
                      will not be shared with third parties without your consent.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button
                      className="flex-1 gradient-primary"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2" /> Submit KYC
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Info boxes at the bottom */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          {[
            {
              icon: Lock,
              title: "Privacy First",
              desc: "ID numbers are SHA-256 hashed client-side. Raw values never reach our servers.",
            },
            {
              icon: ShieldCheck,
              title: "Wallet-Linked",
              desc: "Your verified identity is cryptographically linked to your wallet address.",
            },
            {
              icon: Clock,
              title: "Fast Review",
              desc: "Applications are typically reviewed within 24 hours by our compliance team.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-xl p-4 text-center">
              <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold mb-1">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default KYCVerification;
