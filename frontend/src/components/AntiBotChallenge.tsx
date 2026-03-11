import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Clock, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button, Input } from "@/components/ui";

interface Challenge {
  question: string;
  answer: number;
  generatedAt: number;
}

/** Time before a challenge expires and auto-refreshes (2 minutes). */
const CHALLENGE_TTL_MS = 120_000;

function generateChallenge(): Challenge {
  const ops = ["+", "-", "*"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  if (op === "+") {
    a = Math.floor(Math.random() * 50) + 5;
    b = Math.floor(Math.random() * 50) + 5;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * 50) + 25;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 11) + 2;
    b = Math.floor(Math.random() * 11) + 2;
    answer = a * b;
  }

  return {
    question: `What is ${a} ${op === "*" ? "×" : op} ${b}?`,
    answer,
    generatedAt: Date.now(),
  };
}

interface AntiBotChallengeProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * AntiBotChallenge renders a modal dialog that requires the user to correctly
 * solve a randomly generated arithmetic problem before a ticket purchase
 * proceeds.  The challenge expires after 2 minutes and can be refreshed at
 * any time.
 */
const AntiBotChallenge = ({ open, onVerified, onCancel }: AntiBotChallengeProps) => {
  const [challenge, setChallenge] = useState<Challenge>(generateChallenge);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);

  const refresh = useCallback(() => {
    setChallenge(generateChallenge());
    setInput("");
    setError("");
    setTimeLeft(120);
  }, []);

  // Reset challenge every time the dialog opens
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Countdown + auto-refresh on expiry
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - challenge.generatedAt) / 1000);
      const remaining = 120 - elapsed;
      if (remaining <= 0) {
        refresh();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [open, challenge.generatedAt, refresh]);

  const handleSubmit = () => {
    if (!input.trim()) return;

    const parsed = parseInt(input.trim(), 10);
    if (isNaN(parsed)) {
      setError("Please enter a valid whole number.");
      return;
    }

    // Guard against a race where the challenge sneaks past the countdown
    if (Date.now() - challenge.generatedAt > CHALLENGE_TTL_MS) {
      setError("Challenge expired — generating a new one.");
      refresh();
      return;
    }

    if (parsed !== challenge.answer) {
      setError("Incorrect answer. Try again.");
      setInput("");
      return;
    }

    onVerified();
  };

  const urgencyColor =
    timeLeft <= 20 ? "text-destructive" : timeLeft <= 60 ? "text-amber-400" : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Human Verification
          </DialogTitle>
          <DialogDescription>
            Solve the puzzle below to confirm you're human and proceed with
            your ticket purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timer row */}
          <div className="flex items-center justify-between text-sm">
            <span className={`flex items-center gap-1 ${urgencyColor}`}>
              <Clock className="h-3.5 w-3.5" />
              Expires in {timeLeft}s
            </span>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New challenge
            </button>
          </div>

          {/* Challenge card */}
          <div className="glass rounded-xl p-6 text-center select-none">
            <p className="text-sm text-muted-foreground mb-1">Solve this to continue</p>
            <p className="text-3xl font-mono font-bold tracking-wide text-foreground">
              {challenge.question}
            </p>
          </div>

          {/* Answer input */}
          <Input
            type="number"
            placeholder="Your answer"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            className="text-center font-mono text-lg"
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary hover:opacity-90"
              onClick={handleSubmit}
              disabled={!input.trim()}
            >
              Verify &amp; Buy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AntiBotChallenge;
