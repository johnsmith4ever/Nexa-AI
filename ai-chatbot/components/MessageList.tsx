// MessageList: auto-scroll, empty state with greeting, glass-pill suggestion chips (thin-line icons).
"use client";
import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export type ChatMessage = {
  id: string; role: "user" | "assistant"; content: string;
  images?: string[];
  error?: boolean;
  /** ui:true = this bubble is never sent to the model (guard/error reply) */
  ui?: boolean;
  /** classifies the error kind for rendering */
  kind?: "unavailable" | "rate_limit" | "not_found" | "auth" | "safety" | "timeout" | "unknown" | "interrupted";
};

type Props = {
  tier: "basic" | "pro";
  messages: ChatMessage[];
  streaming: boolean;
  onRetry: (m: ChatMessage) => void;
  onSwitchModel?: () => void;
  onChipClick?: (text: string) => void;
};

// Thin-line lucide-style SVG icons at 16px stroke-1.5
function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 5.29 11.58c-.55.65-.84 1.45-.84 2.42H7.55c0-.97-.29-1.77-.84-2.42A7 7 0 0 1 12 2z" />
    </svg>
  );
}
function IconBug() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88M15.12 3.88 17 2M9 7.13v-1a3.003 3.003 0 0 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M22 13h-4M17.47 9C19.4 8.8 21 7.1 21 5" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

const CHIPS = [
  { Icon: IconBulb,  label: "Explain something",  prompt: "Explain photosynthesis." },
  { Icon: IconBug,   label: "Write code",          prompt: "Help me code a simple dino game" },
  { Icon: IconImage, label: "Analyse an image",    prompt: "Analyse an image" },
  { Icon: IconPen,   label: "Draft an email",      prompt: "Create me an email asking for some extra time to finish a homework." },
];



export default function MessageList({ tier, messages, streaming, onRetry, onSwitchModel, onChipClick }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (autoScroll.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div ref={scrollRef} onScroll={handleScroll} style={{ minHeight: 0, flex: 1, overflowY: "auto" }}>
      <div style={{ margin: "0 auto", width: "100%", maxWidth: 768, padding: "32px 20px 144px" }}>

        {!messages.length ? (
          /* ── Empty / welcome state ── */
          <div
            className="grain"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", textAlign: "center",
              minHeight: "calc(100dvh - 210px)", position: "relative", overflow: "hidden",
            }}
          >
            {/* Pro Eyebrow Pill */}
            {tier === "pro" && (
              <div className="pro-eyebrow">
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, color: "var(--text-primary)" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
                </svg>
                <span>Using our most powerful models</span>
              </div>
            )}

            {/* Sparkle icon only (NEXA wordmark removed) */}
            <div style={{ position: "relative", zIndex: 1, marginBottom: tier === "pro" ? 16 : 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg
                viewBox="15 3 80 80"
                className="logo-glow"
                style={{ width: 40, height: 40, flexShrink: 0 }}
                fill="none"
              >
                <defs>
                  <linearGradient id="hero-star" x1="28" y1="14" x2="82" y2="76" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--g1)"/>
                    <stop offset="0.48" stopColor="var(--g2)"/>
                    <stop offset="1" stopColor="var(--g3)"/>
                  </linearGradient>
                </defs>
                <path d="M55 8C57 29 67 39 88 42C67 45 57 55 55 78C53 55 43 45 22 42C43 39 53 29 55 8Z" fill={tier === "pro" ? "var(--foil)" : "url(#hero-star)"}/>
              </svg>
            </div>

            {/* Greeting Headline */}
            <div style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
              <h1
                className={tier === "pro" ? "nexa-headline-pro" : "nexa-wordmark-grad"}
                style={{
                  fontSize: "clamp(34px, 5vw, 52px)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  marginBottom: 12,
                  paddingBottom: 4, /* prevent text clipping */
                }}
              >
                What are we working on?
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, margin: "0 auto", lineHeight: 1.7 }}>
                Ask anything, write code, or analyse an image.
              </p>
            </div>

            {/* Suggestion chips — glass pills, thin-line icons */}
            {onChipClick && (
              <div
                style={{
                  position: "relative", zIndex: 1,
                  display: "flex", flexWrap: "wrap", gap: 8,
                  justifyContent: "center", maxWidth: 480, width: "100%",
                }}
              >
                {CHIPS.map(({ Icon, label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    className="chip"
                    onClick={() => onChipClick(prompt)}
                    id={`chip-${label.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <span className="chip-icon"><Icon /></span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Conversation ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                waiting={streaming && index === messages.length - 1 && message.role === "assistant" && !message.content}
                onRetry={message.error ? () => onRetry(message) : undefined}
                onSwitchModel={onSwitchModel}
              />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
