// TierSwitch: animated sliding pill with gradient active indicator.
// 40px tall, inner-shadow track, gradient fill + glow on active, shimmer border on Pro locked.
"use client";
import { useRef, useState, useLayoutEffect } from "react";
import type { Tier } from "@/lib/models";

type Props = { tier: Tier; proUnlocked: boolean; onSelect: (tier: Tier) => void };
const TIERS: { id: Tier; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "pro",   label: "Pro"   },
];

export default function TierSwitch({ tier, proUnlocked, onSelect }: Props) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const basicRef  = useRef<HTMLButtonElement>(null);
  const proRef    = useRef<HTMLButtonElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  const [shimmer, setShimmer] = useState(false);
  const prevUnlocked = useRef(proUnlocked);

  useLayoutEffect(() => {
    const btn   = (tier === "basic" ? basicRef : proRef).current;
    const track = trackRef.current;
    if (!btn || !track) return;
    const tr = track.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setInd({ left: br.left - tr.left, width: br.width });
  }, [tier]);

  useLayoutEffect(() => {
    if (proUnlocked && !prevUnlocked.current) {
      setShimmer(true);
      const t = window.setTimeout(() => setShimmer(false), 900);
      prevUnlocked.current = true;
      return () => window.clearTimeout(t);
    }
  }, [proUnlocked]);

  return (
    <div ref={trackRef} className="tier-pill-track" role="tablist" aria-label="Tier">
      {/* Sliding gradient indicator */}
      <div
        className="tier-pill-indicator"
        style={{ left: ind.left, width: ind.width }}
        aria-hidden
      />

      {TIERS.map(({ id, label }) => {
        const active = tier === id;
        const isPro  = id === "pro";
        const locked = isPro && !proUnlocked;

        return (
          <button
            key={id}
            ref={id === "basic" ? basicRef : proRef}
            type="button"
            role="tab"
            id={`tier-${id}`}
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={`tier-pill-btn
              ${locked ? "pro-shimmer-border" : ""}
              ${shimmer && isPro ? "shimmer-once" : ""}
            `}
            style={{
              color: active ? (tier === "pro" ? "var(--newchat-bg)" : "var(--text-primary)") : "var(--text-secondary)",
              textShadow: active && tier !== "pro" ? "0 1px 6px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {/* Lock icon (Pro, locked) */}
            {locked && (
              <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, opacity: 0.65 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            )}
            {/* Sparkle icon (Pro, unlocked) */}
            {isPro && proUnlocked && (
              <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
