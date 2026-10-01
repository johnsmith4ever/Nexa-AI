// TopBar: brand | tier switch (centre) | theme toggle + New Chat (right)
"use client";
import { useEffect, useState } from "react";
import TierSwitch from "./TierSwitch";
import type { Tier } from "@/lib/models";

type Props = { tier: Tier; proUnlocked: boolean; hasMessages: boolean; onNewChat: () => void; onTierSelect: (tier: Tier) => void; onLock: () => void };

// Sun icon
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5"  />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
    </svg>
  );
}

// Moon icon
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// Compose / square-pen icon
function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

// Lock icon for manual locking
function LockClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("nexa-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function TopBar({ tier, proUnlocked, hasMessages, onNewChat, onTierSelect, onLock }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sync with what the inline script already set
  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("nexa-theme", next); } catch {}
  }

  return (
    <header
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        height: 68,
        flexShrink: 0,
        paddingInline: "max(16px, env(safe-area-inset-right))",
        background: hasMessages ? "var(--bar-bg-scrolled)" : "transparent",
        borderBottom: hasMessages ? "1px solid var(--border-subtle)" : "1px solid transparent",
        backdropFilter: hasMessages ? "blur(24px) saturate(180%)" : "none",
        WebkitBackdropFilter: hasMessages ? "blur(24px) saturate(180%)" : "none",
        transition: "background 200ms, border-color 200ms, backdrop-filter 200ms",
        zIndex: 10,
      }}
    >
      {/* Brand: star + NEXA wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, flex: 1 }}>
        {/* Star — blue-violet gradient, reduced glow in light mode */}
        <div style={{ position: "relative", width: 24, height: 24, flexShrink: 0 }}>
          <svg
            viewBox="15 3 80 80"
            style={{
              position: "absolute", inset: 0, width: 24, height: 24,
              filter: theme === "light"
                ? "drop-shadow(0 0 4px rgba(91,140,255,0.25))"
                : "drop-shadow(0 0 10px rgba(91,140,255,0.50)) drop-shadow(0 0 24px rgba(139,92,246,0.30))",
              transition: "opacity 400ms ease-out",
              opacity: tier === "pro" ? 0 : 1,
            }}
            fill="none"
          >
            <defs>
              <linearGradient id="bar-star" x1="28" y1="14" x2="82" y2="76" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6EE7FF"/>
                <stop offset="0.48" stopColor="#4F7CFF"/>
                <stop offset="1" stopColor="#8B5CF6"/>
              </linearGradient>
            </defs>
            <path d="M55 8C57 29 67 39 88 42C67 45 57 55 55 78C53 55 43 45 22 42C43 39 53 29 55 8Z" fill="url(#bar-star)"/>
          </svg>
          <svg
            viewBox="15 3 80 80"
            style={{
              position: "absolute", inset: 0, width: 24, height: 24,
              transition: "opacity 400ms ease-out",
              opacity: tier === "pro" ? 1 : 0,
            }}
            fill="none"
          >
            <path d="M55 8C57 29 67 39 88 42C67 45 57 55 55 78C53 55 43 45 22 42C43 39 53 29 55 8Z" fill="var(--foil)"/>
          </svg>
        </div>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="nexa-wordmark" style={{ fontSize: 15 }}>NEXA</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "1px 6px", borderRadius: 99, border: "1px solid var(--ring)", color: "var(--text-primary)", background: "var(--surface-2)", transition: "opacity 400ms ease-out, transform 400ms ease-out", opacity: tier === "pro" ? 1 : 0, transform: tier === "pro" ? "scale(1)" : "scale(0.95)", pointerEvents: tier === "pro" ? "auto" : "none" }}>PRO</span>
        </div>
      </div>

      {/* Centred tier switch */}
      <div style={{ minWidth: 0, flexShrink: 1, display: "flex", justifyContent: "center" }}>
        <TierSwitch tier={tier} proUnlocked={proUnlocked} onSelect={onTierSelect} />
      </div>

      {/* Right: lock + theme toggle + new chat */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flex: 1, justifyContent: "flex-end" }}>
        {/* Manual Lock */}
        <div className="tooltip-wrap">
          <button
            type="button"
            className="theme-btn"
            onClick={onLock}
            aria-label="Lock App"
          >
            <LockClosedIcon />
          </button>
          <span className="tooltip-label">Lock</span>
        </div>

        {/* Theme toggle */}
        <div className="tooltip-wrap">
          <button
            type="button"
            className="theme-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            id="theme-toggle-btn"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <span className="tooltip-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </div>

        {/* New Chat — solid high-contrast pill */}
        <div className="tooltip-wrap">
          <button
            type="button"
            id="new-chat-btn"
            onClick={onNewChat}
            className="new-chat-btn"
            aria-label="New chat"
          >
            <ComposeIcon />
            <span className="hidden sm:inline">New chat</span>
          </button>
          <span className="tooltip-label">New chat</span>
        </div>
      </div>
    </header>
  );
}
