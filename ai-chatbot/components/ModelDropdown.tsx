// ModelDropdown: pill trigger inside the composer's bottom bar.
// Panel renders in a React portal on document.body, positioned ABOVE the composer card.
// Fully opaque (--menu-bg), z-index 1000, ResizeObserver + window resize recalculate.
"use client";
import { useEffect, useId, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getModelsForTier, models, type ModelDefinition, type Tier } from "@/lib/models";

type Props = {
  tier: Tier;
  modelId: string;
  onChange: (modelId: string) => void;
  /** Ref to the outer composer card div — used to anchor the panel above it. */
  composerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional ref populated with a function to open the picker programmatically */
  onOpenRef?: React.MutableRefObject<(() => void) | null>;
};

// Small type helper so we don't need to import React namespace explicitly
type RefDiv = React.RefObject<HTMLDivElement | null>;

const PROVIDER_ORDER = ["openai", "anthropic", "deepseek", "gemini"] as const;
const PROVIDER_LABELS: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic", deepseek: "DeepSeek", gemini: "Google" };
const PROVIDER_DOT:   Record<string, string> = { openai: "dot-openai", anthropic: "dot-anthropic", deepseek: "dot-deepseek", gemini: "dot-gemini" };

function groupByProvider(items: ModelDefinition[]) {
  const map = new Map<string, ModelDefinition[]>();
  for (const m of items) { const l = map.get(m.provider) ?? []; l.push(m); map.set(m.provider, l); }
  return map;
}

type PanelPos = { bottom: number; left: number; maxHeight: number; width: number };

export default function ModelDropdown({ tier, modelId, onChange, composerRef, onOpenRef }: Props) {
  const available  = getModelsForTier(tier);
  const current    = models[modelId];
  const grouped    = groupByProvider(available);
  const [open, setOpen]       = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [pos, setPos]         = useState<PanelPos>({ bottom: 0, left: 0, maxHeight: 400, width: 260 });
  const [mounted, setMounted] = useState(false);
  const [providersStatus, setProvidersStatus] = useState<Record<string, boolean> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const uid = useId();

  // Only portal on client
  useEffect(() => {
    setMounted(true);
    fetch("/api/providers").then(r => r.json()).then(data => setProvidersStatus(data)).catch(() => {});
  }, []);

  // Expose open trigger
  useEffect(() => {
    if (onOpenRef) {
      onOpenRef.current = () => { setOpen(true); setFocused(null); };
      return () => { onOpenRef.current = null; };
    }
  }, [onOpenRef]);

  // Calculate panel position anchored to composer card
  const recalc = useCallback(() => {
    const trigger  = triggerRef.current;
    const composer = composerRef.current;
    if (!trigger || !composer) return;

    const cRect = composer.getBoundingClientRect();
    const tRect = trigger.getBoundingClientRect();
    const GAP   = 12;
    const PANEL_WIDTH = 268;
    const maxH  = cRect.top - 24;           // never run off top
    const bot   = window.innerHeight - cRect.top + GAP;
    const rawLeft = tRect.left;
    const left  = Math.max(12, Math.min(rawLeft, window.innerWidth - PANEL_WIDTH - 12));

    setPos({ bottom: bot, left, maxHeight: Math.max(120, maxH), width: PANEL_WIDTH });
  }, [composerRef]);

  // Recalc on open
  useEffect(() => { if (open) recalc(); }, [open, recalc]);

  // Recalc on window resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [open, recalc]);

  // Recalc when composer changes height (textarea growing)
  useEffect(() => {
    const el = composerRef.current;
    if (!el || !open) return;
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [composerRef, open, recalc]);

  // Keyboard nav + outside click
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const ids = available.map(m => m.id);
        const cur = focused ?? modelId;
        const idx = ids.indexOf(cur);
        const next = e.key === "ArrowDown"
          ? ids[(idx + 1) % ids.length]
          : ids[(idx - 1 + ids.length) % ids.length];
        setFocused(next);
        panelRef.current?.querySelector<HTMLElement>(`[data-model-id="${next}"]`)?.focus();
      }
      if (e.key === "Enter" && focused) {
        onChange(focused); setOpen(false); triggerRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) { setOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, focused, available, modelId, onChange]);

  const panel = open && mounted && (
    <div
      ref={panelRef}
      id={`${uid}-panel`}
      role="listbox"
      aria-label="Select model"
      className="popover-panel"
      style={{
        position: "fixed",
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        overflowY: "auto",
        zIndex: 1000,
        borderRadius: 16,
        border: "1px solid var(--border-soft)",
        /* Fully opaque — no content shows through */
        background: "var(--menu-bg)",
        boxShadow: "var(--shadow-panel)",
        padding: "6px",
        outline: "none",
      }}
    >
      {PROVIDER_ORDER.map(provider => {
        const group = grouped.get(provider);
        if (!group?.length) return null;
        return (
          <div key={provider}>
            {/* Small-caps provider header */}
            <div style={{
              padding: "6px 10px 3px",
              fontSize: 10, fontWeight: 600,
              letterSpacing: "0.09em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              position: "sticky", top: 0,
              background: "var(--menu-bg)",
            }}>
              {PROVIDER_LABELS[provider]}
            </div>

            {group.map(mdl => {
              const selected = mdl.id === modelId;
              const hasKey = providersStatus ? providersStatus[mdl.provider] : true; // assume true while loading
              const disabled = providersStatus !== null && !hasKey;

              return (
                <button
                  key={mdl.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  data-model-id={mdl.id}
                  tabIndex={0}
                  onClick={() => { if (!disabled) { onChange(mdl.id); setOpen(false); triggerRef.current?.focus(); } }}
                  onFocus={() => { if (!disabled) setFocused(mdl.id); }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 1fr 16px 16px",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    minHeight: 52,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "none",
                    background: selected ? "var(--menu-selected)" : "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "background 120ms",
                    outline: "none",
                    opacity: disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!selected && !disabled) (e.currentTarget as HTMLElement).style.background = "var(--menu-hover)"; }}
                  onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = selected ? "var(--menu-selected)" : "transparent"; }}
                >
                  {/* Provider dot */}
                  <span
                    className={PROVIDER_DOT[mdl.provider]}
                    style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block" }}
                    aria-hidden
                  />

                  {/* Label + subtitle */}
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mdl.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      {disabled && <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--border-soft)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Key missing</span>}
                      <span>{mdl.subtitle ?? ""}</span>
                    </div>
                  </div>

                  {/* Eye / vision badge — fixed slot */}
                  {mdl.vision ? (
                    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, color: "var(--accent-blue)", opacity: 0.7 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Vision">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : <span />}

                  {/* Check — fixed slot */}
                  {selected ? (
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, color: "var(--accent-blue)", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : <span />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Trigger pill */}
      <button
        ref={triggerRef}
        type="button"
        id={`${uid}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => { setOpen(o => !o); setFocused(null); }}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          height: 34, padding: "0 12px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          background: "var(--surface-2)",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 500,
          cursor: "pointer",
          transition: "background 150ms, color 150ms",
          whiteSpace: "nowrap", maxWidth: 220,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--surface)";
          el.style.color = "var(--text-primary)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--surface-2)";
          el.style.color = "var(--text-secondary)";
        }}
      >
        <span
          className={current ? PROVIDER_DOT[current.provider] : ""}
          style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, display: "inline-block" }}
          aria-hidden
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {current?.label ?? "Select model"}
        </span>
        <svg
          viewBox="0 0 24 24"
          style={{ width: 12, height: 12, opacity: 0.5, flexShrink: 0, transition: "transform 150ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Portal — rendered on document.body, fully above the composer */}
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
