// ChatApp owns the in-memory conversation, tier unlock state, streaming lifecycle, and page-level composition.
"use client";

const WIPE_CHAT_ON_LOCK = false;

import { useEffect, useRef, useState } from "react";
import TopBar from "./TopBar";
import MessageList, { type ChatMessage } from "./MessageList";
import Composer from "./Composer";
import UnlockModal from "./UnlockModal";
import { getModelsForTier, models, type Tier } from "@/lib/models";
import { streamChat, StreamError } from "@/lib/transport";

function id() { return crypto.randomUUID(); }

export default function ChatApp() {
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [images, setImages]           = useState<string[]>([]);
  const [warning, setWarning]         = useState("");
  const [tier, setTier]               = useState<Tier>("basic");
  const [modelId, setModelId]         = useState(() => getModelsForTier("basic")[1]?.id ?? getModelsForTier("basic")[0].id);
  const [streaming, setStreaming]     = useState(false);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [proCode, setProCode]         = useState<string | null>(null);
  const [proPassword, setProPassword] = useState<string | null>(null);
  const [showUnlock, setShowUnlock]   = useState(false);
  const [showExitPro, setShowExitPro] = useState(false);
  const [appUnlocked, setAppUnlocked] = useState(false);
  const [basicCode, setBasicCode]     = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // Callback to open model picker — set by Composer/ModelDropdown via a ref trick
  const openPickerRef = useRef<(() => void) | null>(null);

  function lockApp() {
    setAppUnlocked(false);
    setBasicCode(null);
    setProUnlocked(false);
    setProCode(null);
    setProPassword(null);
    setTier("basic");
    if (WIPE_CHAT_ON_LOCK) setMessages([]);
  }

  // (Auto-lock removed)

  // Toggle data-busy on body to drive bottom-edge glow animation
  useEffect(() => {
    if (streaming) document.body.setAttribute("data-busy", "true");
    else document.body.removeAttribute("data-busy");
  }, [streaming]);

  useEffect(() => {
    if (tier === "pro") document.documentElement.setAttribute("data-tier", "pro");
    else document.documentElement.removeAttribute("data-tier");
  }, [tier]);

  function selectTier(nextTier: Tier) {
    if (nextTier === "basic" && tier === "pro") {
      setShowExitPro(true);
      return;
    }
    if (nextTier === "pro" && !proUnlocked) { setShowUnlock(true); return; }
    commitTierChange(nextTier);
  }

  function commitTierChange(nextTier: Tier) {
    setTier(nextTier);
    const tierModels = getModelsForTier(nextTier);
    if (tierModels.length && !tierModels.some((m) => m.id === modelId)) {
      setModelId(nextTier === "basic" ? "gpt-6-luna" : tierModels[0].id);
    }
    if (!models[modelId]?.vision && images.length) setImages([]);
    setWarning("");
  }

  function confirmExitPro() {
    setProUnlocked(false);
    setProCode(null);
    setProPassword(null);
    setShowExitPro(false);
    commitTierChange("basic");
  }

  function changeModel(nextModelId: string) {
    const nextModel = models[nextModelId];
    if (!nextModel) return;
    if (!nextModel.vision && images.length) {
      setImages([]);
      setWarning("Images were cleared because the selected model does not support vision.");
    } else {
      setWarning("");
    }
    setModelId(nextModelId);
  }

  async function sendMessage(retryUserMessage?: ChatMessage) {
    if (streaming) return;

    const content        = retryUserMessage?.content ?? input.trim();
    const attachedImages = retryUserMessage?.images  ?? images;
    if (!content && !attachedImages.length) return;

    const userMessage = retryUserMessage ?? { id: id(), role: "user" as const, content, images: attachedImages };
    let baseMessages = retryUserMessage
      ? messages.slice(0, messages.findIndex((m) => m.id === retryUserMessage.id) + 1)
      : [...messages, userMessage];

    if (retryUserMessage && baseMessages.length === 0) return;

    // PROMPT CACHING: Trim in large chunks. If we drop 1 message per turn, the prefix
    // changes every turn, defeating the cache. By dropping down to ~70% of the limit
    // all at once, the prefix stays perfectly stable for many turns.
    const MAX_HISTORY = 30;
    if (baseMessages.length > MAX_HISTORY) {
      const dropCount = Math.floor(MAX_HISTORY * 0.3);
      baseMessages = baseMessages.slice(dropCount);
    }

    const assistantId: string = id();
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "" };
    const nextMessages = [...baseMessages, assistantMessage];

    setMessages(nextMessages);
    setInput("");
    setImages([]);
    setWarning("");
    setStreaming(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    let accumulated   = "";
    let gotAnyToken   = false;

    try {
      await streamChat({
        tier, modelId,
        messages: baseMessages,
        basicCode,
        proCode,
        proPassword,
        signal: controller.signal,
        onToken(token) {
          gotAnyToken = true;
          accumulated += token;
          setMessages((cur) =>
            cur.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
          );
        },
      });

      // Detect mid-stream interrupt marker appended by the server
      if (accumulated.endsWith("\n\n_Response interrupted._")) {
        const cleanContent = accumulated.slice(0, accumulated.length - "\n\n_Response interrupted._".length).trimEnd();
        setMessages((cur) =>
          cur.map((m) => m.id === assistantId
            ? { ...m, content: cleanContent, error: true, kind: "interrupted" as const }
            : m
          )
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      const streamErr = err instanceof StreamError ? err : null;
      const kind      = streamErr?.kind ?? "unknown";
      const userMsg   = streamErr?.message ?? "Something went wrong.";

      if (kind === "auth") {
        setAppUnlocked(false);
        setBasicCode(null);
        setProUnlocked(false);
        setProCode(null);
        setProPassword(null);
        setTier("basic");
        return;
      }

      if (gotAnyToken) {
        // We were mid-stream — mark the partial as interrupted
        setMessages((cur) =>
          cur.map((m) => m.id === assistantId
            ? { ...m, error: true, kind: "interrupted" as const }
            : m
          )
        );
      } else {
        // No tokens yet — replace the empty assistant bubble with a ui-only error bubble
        setMessages((cur) =>
          cur.map((m) => m.id === assistantId
            ? { ...m, content: userMsg, error: true, ui: true, kind }
            : m
          )
        );
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
  }

  function newChat() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
    setMessages([]);
    setInput("");
    setImages([]);
    setWarning("");
  }

  function retry(assistantMessage: ChatMessage) {
    const index = messages.findIndex((m) => m.id === assistantMessage.id);
    if (index <= 0) return;
    const userMessage = messages[index - 1];
    if (userMessage.role === "user") void sendMessage(userMessage);
  }

  function unlockedPro(code: string, password?: string) {
    setProUnlocked(true);
    setProCode(code);
    if (password) setProPassword(password);
    setShowUnlock(false);
    setTier("pro");
    const proModels = getModelsForTier("pro");
    if (proModels.length) setModelId(proModels[0].id);
  }

  function unlockedBasic(code: string) {
    setBasicCode(code);
    setAppUnlocked(true);
  }

  const selectedModel = models[modelId];

  return (
    <main className="flex h-dvh flex-col" style={{ color: "var(--text-primary)" }}>
      {tier === "pro" && (
        <div className="pro-effects">
          <div className="pro-stars" />
          <div className="pro-specks">
            {Array.from({ length: 14 }).map((_, i) => (
              <div 
                key={i} 
                className="pro-speck" 
                style={{
                  left: `${(i * 17) % 100}%`,
                  top: `${(i * 23) % 100}%`,
                  animationDelay: `${(i * 1.5) % 10}s`,
                  animationDuration: `${15 + ((i * 3) % 10)}s`
                }} 
              />
            ))}
          </div>
        </div>
      )}
      <TopBar tier={tier} proUnlocked={proUnlocked} onNewChat={newChat} onTierSelect={selectTier} hasMessages={messages.length > 0} onLock={lockApp} />
      <MessageList
        tier={tier}
        messages={messages}
        streaming={streaming}
        onRetry={retry}
        onSwitchModel={() => openPickerRef.current?.()}
        onChipClick={(prompt) => setInput(prompt)}
      />
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-4 pt-12"
        style={{ background: "linear-gradient(to top, var(--fade-bg) 35%, transparent 100%)" }}
      >
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <Composer
            tier={tier} modelId={modelId} input={input} images={images}
            streaming={streaming} warning={warning}
            onInputChange={setInput} onImagesChange={setImages}
            onModelChange={changeModel} onWarning={setWarning}
            onSend={() => void sendMessage()} onStop={stop}
            onOpenPickerRef={openPickerRef}
          />
        </div>
      </div>
      {showUnlock && <UnlockModal mode="pro" onClose={() => setShowUnlock(false)} onUnlocked={(code, pwd) => unlockedPro(code, pwd)} />}
      {!appUnlocked && <UnlockModal mode="app" onUnlocked={(code) => unlockedBasic(code)} />}
      {showExitPro && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--scrim-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", animation: "fade-in 150ms ease-out" }} onClick={() => setShowExitPro(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, margin: 16, boxShadow: "var(--shadow-panel)", animation: "scale-up 150ms cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Exit Pro mode?</h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.4 }}>You'll need your code and password to come back.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button autoFocus onClick={() => setShowExitPro(false)} style={{ width: "100%", height: 44, borderRadius: 12, background: "var(--foil)", border: "none", color: "var(--text-primary)", fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "filter 150ms" }} onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.1)")} onMouseLeave={e => (e.currentTarget.style.filter = "none")}>Stay in Pro</button>
              <button onClick={confirmExitPro} style={{ width: "100%", height: 44, borderRadius: 12, background: "transparent", border: "1px solid var(--border-soft)", color: "var(--text-secondary)", fontWeight: 500, fontSize: 15, cursor: "pointer", transition: "background 150ms, color 150ms" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}>Exit Pro</button>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only">Selected model: {selectedModel?.label}</span>
    </main>
  );
}
