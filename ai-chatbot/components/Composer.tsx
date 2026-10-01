// Composer: glass card, focus-glow border, gradient send, 9-dot spinner while streaming.
"use client";
import { useEffect, useRef, useState } from "react";
import ImageAttach from "./ImageAttach";
import ModelDropdown from "./ModelDropdown";
import { Spinner } from "./Spinner";
import { models, type Tier } from "@/lib/models";

type Props = {
  tier: Tier; modelId: string; input: string; images: string[];
  streaming: boolean; warning: string;
  onInputChange: (v: string) => void; onImagesChange: (imgs: string[]) => void;
  onModelChange: (id: string) => void; onWarning: (w: string) => void;
  onSend: () => void; onStop: () => void;
  /** Ref populated by Composer so parent can open the model picker programmatically */
  onOpenPickerRef?: React.MutableRefObject<(() => void) | null>;
};

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }} fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="m6 11 6-6 6 6" />
    </svg>
  );
}

export default function Composer({ tier, modelId, input, images, streaming, warning, onInputChange, onImagesChange, onModelChange, onWarning, onSend, onStop, onOpenPickerRef }: Props) {
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const composerCardRef  = useRef<HTMLDivElement>(null);
  const openPickerTrigger = useRef<(() => void) | null>(null);
  const [hoverStop, setHoverStop] = useState(false);

  // Expose open-picker trigger to parent
  useEffect(() => {
    if (onOpenPickerRef) onOpenPickerRef.current = () => openPickerTrigger.current?.();
    return () => { if (onOpenPickerRef) onOpenPickerRef.current = null; };
  }, [onOpenPickerRef]);
  const model      = models[modelId];
  const canAttach  = Boolean(model?.vision) && !streaming;
  const hasContent = input.trim().length > 0 || images.length > 0;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming && hasContent) onSend();
    }
  }

  function handleModelChange(nextId: string) {
    const next = models[nextId];
    if (!next) return;
    if (!next.vision && images.length) {
      onImagesChange([]);
      onWarning("Images were cleared because the selected model does not support vision.");
    } else {
      onWarning("");
    }
    onModelChange(nextId);
  }

  return (
    <div>
      {/* Warning */}
      {warning && (
        <div style={{
          marginBottom: 8, padding: "8px 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(251,191,36,0.20)",
          background: "rgba(251,191,36,0.07)",
          fontSize: 12, color: "rgba(180,140,30,0.95)",
        }}>
          {warning}
        </div>
      )}

      {/* Rainbow wrapper for conic border + glow */}
      <div className={`composer-rainbow-wrap ${streaming ? "streaming" : ""}`}>
        {/* Glass composer card */}
        <div
          ref={composerCardRef}
          className="composer-card"
          style={{
            borderRadius: "var(--radius-2xl)",
            padding: "4px 4px 8px",
            boxShadow: "var(--shadow-composer)",
            background: "var(--surface)",
            position: "relative",
            zIndex: 1,
          }}
        >
        {/* Image thumbnails */}
        <ImageAttach
          images={images}
          enabled={canAttach}
          disabledReason="The selected model does not support images."
          onChange={onImagesChange}
          onWarning={onWarning}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
          placeholder="Ask Nexa"
          className="disabled:opacity-60 nexa-textarea"
          style={{
            display: "block", width: "100%", background: "transparent",
            resize: "none", overflowY: "auto", maxHeight: 180, minHeight: 52,
            padding: "14px 16px 6px", fontSize: 14, lineHeight: "1.65",
            color: "var(--text-primary)", outline: "none", fontFamily: "inherit",
          }}
        />


        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 6px 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Model picker */}
            <ModelDropdown tier={tier} modelId={modelId} onChange={handleModelChange} composerRef={composerCardRef} onOpenRef={openPickerTrigger} />
            
            {/* Attach button (neutral, tonal surface) */}
            <button
              type="button"
              disabled={!canAttach}
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              title={canAttach ? "Attach images" : "Model does not support images"}
              aria-label="Attach images"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: "var(--surface-2)", color: "var(--text-primary)",
                cursor: canAttach ? "pointer" : "not-allowed",
                opacity: canAttach ? 1 : 0.4,
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={e => { if(canAttach) { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.filter = "brightness(1.05)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.filter = "none"; }}
            >
              <svg viewBox="0 0 24 24" style={{width:15,height:15}} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </div>

          {/* Send / Stop */}
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              onMouseEnter={() => setHoverStop(true)}
              onMouseLeave={() => setHoverStop(false)}
              aria-label={hoverStop ? "Stop generating" : "Streaming…"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: tier === "pro" ? "var(--foil)" : "var(--grad-accent)",
                color: tier === "pro" ? "var(--newchat-bg)" : "#fff", cursor: "pointer", flexShrink: 0,
                transition: "opacity var(--dur-fast), transform var(--dur-fast), box-shadow var(--dur-fast)",
                boxShadow: "var(--shadow-glow-blue)",
              }}
            >
              {/* Hover = stop square; otherwise = spinner */}
              {hoverStop ? <StopIcon /> : <Spinner size={16} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!hasContent}
              aria-label="Send message"
              className={hasContent && tier !== "pro" ? "send-btn" : ""}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: "50%", border: "none",
                color: hasContent ? (tier === "pro" ? "var(--newchat-bg)" : "#fff") : "var(--text-muted)",
                cursor: hasContent ? "pointer" : "default",
                flexShrink: 0,
                background: hasContent ? (tier === "pro" ? "var(--foil)" : undefined) : (tier === "pro" ? "var(--menu-selected)" : "var(--surface-2)"),
                transition: "background 150ms, filter 150ms",
              }}
              onMouseEnter={e => { if (hasContent && tier === "pro") e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { if (hasContent && tier === "pro") e.currentTarget.style.filter = "none"; }}
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Disclaimer */}
      <p style={{ marginTop: 8, textAlign: "center", fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>
        AI responses can make mistakes. Check important information.
      </p>
    </div>
  );
}
