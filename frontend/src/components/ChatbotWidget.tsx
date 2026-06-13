import { type KeyboardEvent, useMemo, useState } from "react";
import { Bot, Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { chatbot, type ChatMessage } from "@/integrations/mongodb/client";
import { cn } from "@/lib/utils";

const STARTER_TEXT =
  "Hi, I am TicketShield Assistant. Ask me about events, tickets, resale, wallet setup, or check-in.";

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function localIntentReply(input: string): string {
  const text = input.toLowerCase();

  if (hasAny(text, ["resale", "re sale", "resell", "sell", "re-sell", "tickit"])) {
    return "Yes. You can resell after purchase if resale is enabled for that event. Go to My Tickets, choose your ticket, tap List for Resale, set a valid price within platform rules, and confirm in wallet. Once listed, buyers can purchase it from Resale Market.";
  }

  if (hasAny(text, ["buy", "purchase", "book", "ticket"])) {
    return "To buy a ticket: open Events, select an event, pick a tier/quantity, complete anti-bot challenge, and confirm the blockchain transaction in your wallet. Your ticket then appears in My Tickets with a dynamic QR.";
  }

  if (hasAny(text, ["check-in", "check in", "scan", "qr", "verify"])) {
    return "For check-in: admin opens Scanner Console, scans the user's dynamic QR (or uses Scan Image), and the system verifies ticketId plus rolling token before marking it checked in.";
  }

  if (hasAny(text, ["wallet", "metamask", "connect"])) {
    return "For wallet setup: install/open MetaMask, switch to the configured network, then click Connect Wallet in the app. Approve the connection request to continue.";
  }

  if (hasAny(text, ["event", "create", "organizer"])) {
    return "Organizers can create events from Organizer Dashboard. Add event details, ticket tiers, supplies, pricing, and publish. Tickets become available to buyers on Events page.";
  }

  return "I can help with events, ticket purchase, resale, wallet setup, and check-in. Ask me a specific question and I will give step-by-step guidance.";
}

function shouldUseLocalFallback(userText: string, reply: string): boolean {
  const r = reply.toLowerCase();
  const u = userText.toLowerCase();

  if (r.includes("quota exceeded") || r.includes("temporarily unavailable")) return true;
  if (hasAny(u, ["resale", "resell", "sell", "tickit"]) && !hasAny(r, ["resale", "resell", "list", "market"])) return true;
  return false;
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: STARTER_TEXT },
  ]);

  const history = useMemo(
    () => messages.filter((message) => message.text !== STARTER_TEXT),
    [messages],
  );

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: message }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await chatbot.sendMessage(message, history);
      const finalReply = shouldUseLocalFallback(message, reply)
        ? localIntentReply(message)
        : reply;
      setMessages((previous) => [...previous, { role: "assistant", text: reply }]);
      if (finalReply !== reply) {
        setMessages((previous) => {
          const updated = [...previous];
          updated[updated.length - 1] = { role: "assistant", text: finalReply };
          return updated;
        });
      }
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: localIntentReply(message),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/15 p-2 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">TicketShield Assistant</p>
                <p className="text-xs text-muted-foreground">Powered by Gemini</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {message.text}
              </div>
            ))}

            {loading ? (
              <div className="mr-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            ) : null}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onEnter}
                placeholder="Ask about tickets, resale, wallet..."
                maxLength={1200}
                disabled={loading}
              />
              <Button type="button" size="icon" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-12 rounded-full px-4 shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          Ask Assistant
        </Button>
      )}
    </div>
  );
}
