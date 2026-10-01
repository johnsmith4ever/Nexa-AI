// UnlockModal: 6-digit combination-lock dial.
// Interaction: scroll, drag, arrow keys, ▲▼ buttons, or direct digit typing (auto-advance).
// Visual: animated lock shackle (opens on success), shake + red glow on wrong code.
"use client";
import { useState, useRef, useCallback, useEffect, useId } from "react";
import { Spinner } from "./Spinner";
import { unlockPro, unlockBasic } from "@/lib/transport";

const DIGITS = 6;
const DIGIT_RANGE = Array.from({ length: 10 }, (_, i) => i); // 0-9

// ─── Single digit wheel ────────────────────────────────────────────
type WheelProps = {
  value: number;
  focused: boolean;
  wheelId: string;
  onChange: (v: number) => void;
  onFocus: () => void;
  onNext: () => void;
  onPrev: () => void;
};

function DigitWheel({ value, focused, wheelId, onChange, onFocus, onNext, onPrev }: WheelProps) {
  const prev = (value + 9) % 10;
  const next = (value + 1) % 10;
  const dragStart = useRef<{ y: number; val: number } | null>(null);

  function increment() { onChange((value + 1) % 10); }
  function decrement() { onChange((value + 9) % 10); }

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { y: e.clientY, val: value };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - e.clientY;
    const steps = Math.round(delta / 18);
    if (steps !== 0) {
      onChange((dragStart.current.val + steps * -1 + 100) % 10);
    }
  }
  function onPointerUp() { dragStart.current = null; }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) increment();
    else decrement();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp")   { e.preventDefault(); increment(); }
    if (e.key === "ArrowDown") { e.preventDefault(); decrement(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); onPrev(); }
    if (e.key === "ArrowRight"){ e.preventDefault(); onNext(); }
    if (/^\d$/.test(e.key)) {
      onChange(Number(e.key));
      onNext();
    }
    if (e.key === "Backspace") { e.preventDefault(); onPrev(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {/* Up arrow */}
      <button
        type="button"
        onClick={increment}
        tabIndex={-1}
        aria-label="Increment"
        style={{
          width: 28, height: 20, border: "none", background: "transparent",
          color: focused ? "var(--accent-blue)" : "var(--wheel-arrow)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color 150ms",
          fontSize: 10,
        }}
      >▲</button>

      {/* Wheel track */}
      <div
        id={wheelId}
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={9}
        aria-label={`Digit ${wheelId.split("-").pop()}`}
        tabIndex={0}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "relative",
          width: 42,
          height: 60,
          overflow: "hidden",
          borderRadius: 10,
          border: focused
            ? "1.5px solid var(--accent-blue)"
            : "1px solid var(--wheel-border)",
          background: focused
            ? "var(--glow-blue)"
            : "var(--wheel-bg)",
          cursor: "ns-resize",
          userSelect: "none",
          outline: "none",
          transition: "border-color 150ms, background 150ms",
          boxShadow: focused ? "0 0 0 2px var(--glow-blue)" : "none",
        }}
      >
        {/* Fade mask top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 18,
          background: "linear-gradient(to bottom, var(--wheel-fade-bg) 0%, transparent 100%)",
          zIndex: 2, pointerEvents: "none", borderRadius: "10px 10px 0 0",
        }} />
        {/* Fade mask bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 18,
          background: "linear-gradient(to top, var(--wheel-fade-bg) 0%, transparent 100%)",
          zIndex: 2, pointerEvents: "none", borderRadius: "0 0 10px 10px",
        }} />

        {/* Three visible digit slots: prev / current / next */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 0,
        }}>
          <span style={{ fontSize: 16, lineHeight: "20px", opacity: 0.28, color: "var(--wheel-digit)", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{prev}</span>
          <span style={{ fontSize: 22, lineHeight: "22px", opacity: 1,    color: focused ? "var(--accent-blue)" : "var(--wheel-digit)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{value}</span>
          <span style={{ fontSize: 16, lineHeight: "20px", opacity: 0.28, color: "var(--wheel-digit)", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{next}</span>
        </div>
      </div>

      {/* Down arrow */}
      <button
        type="button"
        onClick={decrement}
        tabIndex={-1}
        aria-label="Decrement"
        style={{
          width: 28, height: 20, border: "none", background: "transparent",
          color: focused ? "var(--accent-blue)" : "var(--wheel-arrow)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color 150ms",
          fontSize: 10,
        }}
      >▼</button>
    </div>
  );
}

// ─── Lock shackle SVG ──────────────────────────────────────────────
function LockIcon({ open, glow, wrong }: { open: boolean; glow: boolean; wrong: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      style={{
        width: 56, height: 64,
        filter: glow
          ? "drop-shadow(0 0 12px rgba(91,140,255,0.8)) drop-shadow(0 0 24px rgba(139,92,246,0.5))"
          : wrong
          ? "drop-shadow(0 0 10px rgba(239,68,68,0.7))"
          : "none",
        transition: "filter 300ms",
      }}
      aria-hidden
    >
      {/* Shackle — transforms when open */}
      <g
        style={{
          transformOrigin: "40px 12px",
          transform: open ? "rotate(40deg) translateY(-6px)" : "rotate(0deg)",
          transition: open ? "transform 450ms cubic-bezier(0.34,1.56,0.64,1)" : "transform 200ms ease",
        }}
      >
        <path
          d="M14 24 V14 A10 10 0 0 1 34 14 V24"
          fill="none"
          stroke={wrong ? "#f87171" : glow ? "var(--accent-violet)" : "var(--text-secondary)"}
          strokeWidth="4"
          strokeLinecap="round"
          style={{ transition: "stroke 300ms" }}
        />
      </g>
      {/* Lock body */}
      <rect
        x="6" y="24" width="36" height="28" rx="5"
        fill={wrong ? "rgba(239,68,68,0.15)" : glow ? "var(--glow-blue)" : "var(--glass-bg-e)"}
        stroke={wrong ? "#f87171" : glow ? "var(--accent-violet)" : "var(--border-subtle)"}
        strokeWidth="1.5"
        style={{ transition: "fill 300ms, stroke 300ms" }}
      />
      {/* Keyhole */}
      <circle cx="24" cy="35" r="4"
        fill={wrong ? "#f87171" : glow ? "var(--accent-violet)" : "var(--text-muted)"}
        style={{ transition: "fill 300ms" }}
      />
      <rect x="22" y="37" width="4" height="6" rx="1"
        fill={wrong ? "#f87171" : glow ? "var(--accent-violet)" : "var(--text-muted)"}
        style={{ transition: "fill 300ms" }}
      />
    </svg>
  );
}

// ─── Main modal ────────────────────────────────────────────────────
type Props = { 
  mode?: "pro" | "app";
  onClose?: () => void; 
  onUnlocked: (code: string, password?: string) => void;
};

export default function UnlockModal({ mode = "pro", onClose, onUnlocked }: Props) {
  const [digits, setDigits]   = useState<number[]>(Array(DIGITS).fill(0));
  const [focused, setFocused] = useState(0);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake]     = useState(false);
  const [wrong, setWrong]     = useState(false);
  const [open, setOpen]       = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [devHint, setDevHint] = useState("");
  const uid = useId();
  const wheelRefs = useRef<Array<HTMLElement | null>>(Array(DIGITS).fill(null));

  const code = digits.join("");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      fetch("/api/unlock/status").then(r => r.json()).then(data => {
        if (mode === "app") {
          if (!data.basicCodeSet || data.basicCodeLength !== 6) {
            setDevHint("BASIC_CODE missing or not 6 digits in .env.local, restart the dev server");
          }
        } else if (mode === "pro") {
          if (!data.proCodeSet || data.proCodeLength !== 6 || !data.proPasswordSet) {
            setDevHint("PRO_CODE (6 digits) or PRO_PASSWORD missing in .env.local, restart the dev server");
          }
        }
      }).catch(() => {});
    }
  }, [mode]);

  function setDigit(index: number, value: number) {
    setDigits(d => { const next = [...d]; next[index] = value; return next; });
  }

  function focusWheel(index: number) {
    const clamped = Math.max(0, Math.min(DIGITS - 1, index));
    setFocused(clamped);
    document.getElementById(`${uid}-wheel-${clamped}`)?.focus();
  }

  function triggerShake() {
    setShake(true);
    setWrong(true);
    window.setTimeout(() => { setShake(false); setWrong(false); }, 600);
  }

  async function submit() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      if (mode === "app") {
        await unlockBasic(code);
      } else {
        await unlockPro(code, password);
      }
      setOpen(true);
      // Wait for shackle animation, then close
      window.setTimeout(() => onUnlocked(code, password), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Incorrect code or password.";
      setError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
      if (e.key === "Enter") void submit();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
        background: "var(--bg-overlay)",
        opacity: 0.98,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "app" ? "Unlock Nexa" : "Unlock Pro"}
    >
      <div
        className={shake ? "shake" : ""}
        style={{
          width: "100%", maxWidth: 380,
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-subtle)",
          background: "var(--glass-bg-e)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "32px 28px 28px",
          boxShadow: "var(--shadow-xl)",
          position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 0,
        }}
      >
        {/* Accent top line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: open
            ? "linear-gradient(90deg,var(--accent-blue),var(--accent-violet))"
            : wrong
            ? "#f87171"
            : "var(--border-subtle)",
          transition: "background 300ms",
        }} aria-hidden />

        {/* Close button (Cross) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute", top: 12, right: 12, width: 28, height: 28,
              border: "none", background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)", borderRadius: "var(--radius-sm)",
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
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1L13 13M1 13L13 1" />
            </svg>
          </button>
        )}

        {/* Lock icon */}
        <div style={{ marginBottom: 20 }}>
          <LockIcon open={open} glow={open} wrong={wrong} />
        </div>

        {mode === "pro" && (
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            Unlock Pro
          </h2>
        )}
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>
          {mode === "app" 
            ? "Enter the 6-digit combination to access the app."
            : "Enter the 6-digit code to access Pro models."}
        </p>

        {/* 6 digit wheels */}
        <div
          style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 24 }}
          role="group"
          aria-label="6-digit combination code"
        >
          {digits.map((val, i) => (
            <DigitWheel
              key={i}
              value={val}
              focused={focused === i}
              wheelId={`${uid}-wheel-${i}`}
              onChange={v => setDigit(i, v)}
              onFocus={() => setFocused(i)}
              onNext={() => focusWheel(i + 1)}
              onPrev={() => focusWheel(i - 1)}
            />
          ))}
        </div>

        {/* Password input for Pro mode */}
        {mode === "pro" && (
          <div style={{ position: "relative", width: "100%", marginBottom: 24 }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="off"
              style={{
                width: "100%", height: 42, padding: "0 40px 0 16px",
                borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                background: "var(--wheel-bg)", color: "var(--text-primary)", fontSize: 14,
                outline: "none", transition: "border-color 150ms",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              tabIndex={-1}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 28, height: 28, border: "none", background: "transparent",
                color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? "👁️‍🗨️" : "👁️"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            width: "100%", marginBottom: 16,
            padding: "8px 12px", borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(248,113,113,0.15)", background: "rgba(248,113,113,0.07)",
            fontSize: 12, color: "rgba(252,165,165,0.9)", textAlign: "center",
          }}>
            {error}
          </div>
        )}
        
        {/* Dev Hint */}
        {devHint && (
          <div style={{
            width: "100%", marginBottom: 16,
            padding: "8px 12px", borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.1)",
            fontSize: 11, color: "rgba(253,224,71,0.9)", textAlign: "center",
          }}>
            {devHint}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading || open}
            style={{
              flex: 1, height: 42, borderRadius: "var(--radius-md)",
              border: "none",
              background: open
                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : "linear-gradient(135deg,var(--accent-blue),var(--accent-violet))",
              fontSize: 13, fontWeight: 500, color: "white", cursor: "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "background 300ms, opacity 150ms, transform 150ms",
            }}
            onMouseEnter={e => { if (!loading && !open) (e.currentTarget as HTMLElement).style.transform = "scale(1.01)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            {open ? "✓ Unlocked!" : loading ? <Spinner size={16} /> : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
