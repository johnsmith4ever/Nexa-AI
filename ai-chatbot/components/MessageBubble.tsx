// MessageBubble: user glass pill + assistant markdown, fully theme-aware.
// All colors use CSS variables — works in dark and Aurora Light.
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Spinner } from "./Spinner";
import type { ChatMessage } from "./MessageList";

type Props = { message: ChatMessage; waiting: boolean; onRetry?: () => void; onSwitchModel?: () => void };

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Small star / Nexa avatar for the assistant
function StarAvatar() {
  return (
    <div style={{
      width: 22, height: 22, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      filter: "drop-shadow(0 0 10px var(--glow-blue))",
    }}>
      <svg viewBox="15 3 80 80" style={{ width: 22, height: 22 }} fill="none">
        <path d="M55 8C57 29 67 39 88 42C67 45 57 55 55 78C53 55 43 45 22 42C43 39 53 29 55 8Z" fill="var(--accent-blue)" />
      </svg>
    </div>
  );
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const language = className?.replace("language-", "") || "code";

  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div style={{
      margin: "16px 0", overflow: "hidden",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border-subtle)",
      background: "var(--code-bg)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 36, padding: "0 12px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--code-header)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{language}</span>
        <button
          type="button" onClick={copy}
          style={{
            padding: "3px 8px", borderRadius: "var(--radius-sm)", border: "none",
            background: "transparent", fontSize: 11, color: "var(--text-muted)", cursor: "pointer",
            transition: "background 150ms, color 150ms",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-e)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre style={{ overflowX: "auto", padding: "14px 16px", fontSize: 13, lineHeight: 1.65, margin: 0, color: "var(--text-primary)" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MessageBubble({ message, waiting, onRetry, onSwitchModel }: Props) {
  /* ── User bubble ── */
  if (message.role === "user") {
    return (
      <div className="msg-in" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "80%",
          borderRadius: "20px 20px 6px 20px",
          background: "var(--bubble-user-bg)",
          border: "1px solid var(--bubble-user-border)",
          boxShadow: "var(--bubble-user-shadow)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "10px 16px",
          fontSize: 14, lineHeight: 1.65,
          color: "var(--text-primary)",
        }}>
          {message.images?.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 10 }}>
              {message.images.map((src, i) => (
                <img key={`${src}-${i}`} src={src} alt=""
                  style={{ maxHeight: 160, width: "100%", objectFit: "cover", borderRadius: "var(--radius-md)" }} />
              ))}
            </div>
          ) : null}
          {message.content && <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>}
        </div>
      </div>
    );
  }

  /* ── Assistant response ── */
  return (
    <div className="msg-in" style={{ display: "flex", justifyContent: "flex-start", gap: 10 }}>
      <div style={{ paddingTop: 2, flexShrink: 0 }}><StarAvatar /></div>
      <div style={{ maxWidth: "100%", minWidth: 0, fontSize: 14, lineHeight: 1.75, color: "var(--text-primary)" }}>

        {/* Waiting: spinner + "Thinking…" shimmer.
             Fades out in 150ms the moment first token arrives (no layout jump). */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "2px 0",
          opacity: waiting && !message.content ? 1 : 0,
          transition: "opacity 150ms ease-out",
          pointerEvents: "none",
          position: waiting && !message.content ? "relative" : "absolute",
          height: waiting && !message.content ? undefined : 0,
          overflow: "hidden",
          color: "var(--text-muted)",
        }}>
          <Spinner size={18} />
          <span className="thinking-text" style={{ fontSize: 13, fontWeight: 450 }}>Thinking…</span>
        </div>

        {/* Markdown content */}
        {message.content && (
          <div className={waiting ? "typing-cursor" : ""}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  const block = Boolean(className) || String(children).includes("\n");
                  return block
                    ? <CodeBlock className={className}>{children}</CodeBlock>
                    : (
                      <code style={{
                        borderRadius: "var(--radius-sm)",
                        background: "var(--code-inline)",
                        border: "1px solid var(--border-subtle)",
                        padding: "2px 6px", fontSize: 13,
                        color: "var(--text-primary)",
                      }}>{children}</code>
                    );
                },
                p:  ({ children }) => <p  style={{ margin: "6px 0", color: "var(--text-primary)", lineHeight: 1.75 }}>{children}</p>,
                h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 600, margin: "20px 0 8px",  color: "var(--text-primary)" }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 600, margin: "18px 0 6px",  color: "var(--text-primary)" }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "14px 0 4px",  color: "var(--text-primary)" }}>{children}</h3>,
                li: ({ children }) => <li style={{ margin: "2px 0",                                       color: "var(--text-primary)" }}>{children}</li>,
                a:  ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer"
                    style={{ color: "var(--accent-blue)", textDecoration: "underline", textDecorationColor: "var(--glow-blue)" }}>
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* ── Interrupted note (mid-stream abort) ── */}
        {message.kind === "interrupted" && (
          <div style={{
            marginTop: 10, display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, color: "var(--text-muted)", opacity: 0.75,
          }}>
            <WarningIcon />
            <span>Response interrupted.</span>
            {onRetry && (
              <button type="button" onClick={onRetry} style={ActionBtnStyle}>
                Retry
              </button>
            )}
          </div>
        )}

        {/* ── Error bubble (full error, no content) ── */}
        {message.error && message.ui && (
          <ErrorBubble message={message.content} onRetry={onRetry} onSwitchModel={onSwitchModel} />
        )}

        {/* ── Normal retry button (non-ui error with partial content) ── */}
        {message.error && !message.ui && message.kind !== "interrupted" && onRetry && (
          <button type="button" onClick={onRetry} style={ActionBtnStyle}>
            ↻ Retry
          </button>
        )}
      </div>
    </div>
  );
}

const ActionBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle)",
  background: "var(--glass-bg)",
  fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
};

function ErrorBubble({ message, onRetry, onSwitchModel }: { message: string; onRetry?: () => void; onSwitchModel?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px",
      borderRadius: "var(--radius-md)",
      border: "1px solid rgba(251,113,133,0.18)",
      background: "rgba(251,113,133,0.05)",
      fontSize: 12, color: "var(--text-secondary)",
    }}>
      <span style={{ color: "rgba(251,113,133,0.8)", paddingTop: 1, flexShrink: 0 }}><WarningIcon /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {onRetry && (
            <button type="button" onClick={onRetry}
              style={{ ...ActionBtnStyle, fontSize: 11 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-e)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass-bg)";   (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            >
              ↻ Retry
            </button>
          )}
          {onSwitchModel && (
            <button type="button" onClick={onSwitchModel}
              style={{ ...ActionBtnStyle, fontSize: 11 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass-bg-e)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass-bg)";   (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            >
              Switch model
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
