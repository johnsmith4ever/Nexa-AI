import type { Tier } from "./models";

export type ClientMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  /** ui: true means this is a UI-only bubble (error/guard). Excluded from API history. */
  ui?: boolean;
  error?: boolean;
};

export type StreamErrorKind =
  | "unavailable"
  | "rate_limit"
  | "not_found"
  | "auth"
  | "safety"
  | "timeout"
  | "unknown";

export class StreamError extends Error {
  kind: StreamErrorKind;
  constructor(message: string, kind: StreamErrorKind = "unknown") {
    super(message);
    this.kind = kind;
    this.name = "StreamError";
  }
}

type StreamOptions = {
  tier: Tier;
  modelId: string;
  messages: ClientMessage[];
  basicCode?: string | null;
  proCode?: string | null;
  proPassword?: string | null;
  signal?: AbortSignal;
  onToken: (token: string) => void;
};

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

async function previewStream(options: StreamOptions) {
  const lastUser = [...options.messages].reverse().find((message) => message.role === "user");
  const imageText = lastUser?.images?.length
    ? ` I can also see ${lastUser.images.length} attached image${lastUser.images.length === 1 ? "" : "s"}.` : "";
  const reply = `Preview mode is working.\n\nYou selected **${options.modelId}** in the **${options.tier}** tier.${imageText}\n\nThis response is intentionally streamed token-by-token so you can test the loading state, auto-scroll, Stop button, model switching, image handling, and Pro unlock flow without API keys.\n\nWhen you are ready, set \`NEXT_PUBLIC_PREVIEW_MODE=false\` and fill in your server environment variables.`;
  const tokens = reply.match(/\S+\s*/g) ?? [];
  for (const token of tokens) {
    await sleep(35, options.signal);
    options.onToken(token);
  }
}

/**
 * Strip ui-only messages before sending to the API.
 * PROMPT CACHING: It is critical that this array remains perfectly stable
 * (exact same objects, same keys, same image byte data) so the prefix of
 * the request matches previous ones and hits the API provider's cache.
 */
function cleanMessages(messages: ClientMessage[]) {
  return messages
    .filter((m) => !m.ui)
    .map(({ role, content, images }) => ({ role, content, images }));
}

export async function streamChat(options: StreamOptions) {
  if (PREVIEW) {
    await previewStream(options);
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.basicCode) {
    headers["x-basic-code"] = options.basicCode;
  }
  if (options.tier === "pro") {
    if (options.proCode) headers["x-pro-code"] = options.proCode;
    if (options.proPassword) headers["x-pro-password"] = options.proPassword;
  }

  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers,
      signal: options.signal,
      body: JSON.stringify({
        tier: options.tier,
        modelId: options.modelId,
        messages: cleanMessages(options.messages),
      }),
    });
  } catch (fetchError) {
    if (fetchError instanceof DOMException && fetchError.name === "AbortError") throw fetchError;
    throw new StreamError("Network error — check your connection.", "unavailable");
  }

  if (!response.ok) {
    let userMessage = `Request failed (${response.status}).`;
    let kind: StreamErrorKind = "unavailable";
    try {
      const data = await response.json();
      if (typeof data?.error === "string") userMessage = data.error;
      if (typeof data?.kind  === "string") kind = data.kind as StreamErrorKind;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        // Try to parse as nexa error JSON
        try {
          const data = JSON.parse(text);
          if (typeof data?.error === "string") userMessage = data.error;
          if (typeof data?.kind  === "string") kind = data.kind as StreamErrorKind;
        } catch { userMessage = text.slice(0, 200); }
      }
    }
    throw new StreamError(userMessage, kind);
  }

  if (!response.body) throw new StreamError("The server returned no response stream.", "unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) options.onToken(text);
  }

  const finalText = decoder.decode();
  if (finalText) options.onToken(finalText);
}

export async function unlockPro(code: string, password?: string) {
  const normalisedCode = String(code).trim();
  const normalisedPass = password || "";

  if (PREVIEW) {
    if (!/^\d{6}$/.test(normalisedCode)) throw new Error("Incorrect code or password");
    if (!normalisedPass) throw new Error("Incorrect code or password");
    return { ok: true };
  }

  const response = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "pro", code: normalisedCode, password: normalisedPass }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data?.error === "rate_limited") {
      const mins = data?.retryAfter ?? 15;
      throw new Error(`Too many attempts — try again in ${mins} min.`);
    }
    if (data?.error === "not_configured") {
      throw new Error("Pro isn't set up: PRO_CODE or PRO_PASSWORD is missing on the server.");
    }
    throw new Error("Incorrect code or password");
  }

  return data as { ok: true };
}

export async function unlockBasic(code: string): Promise<{ ok: true }> {
  const normalisedCode = String(code).trim();
  
  if (PREVIEW) {
    if (!/^\d{6}$/.test(normalisedCode)) throw new Error("Incorrect code");
    return { ok: true };
  }

  const response = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "basic", code: normalisedCode }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data?.error === "rate_limited") {
      const mins = data?.retryAfter ?? 15;
      throw new Error(`Too many attempts — try again in ${mins} min.`);
    }
    if (data?.error === "not_configured") {
      throw new Error("Basic mode isn't set up: BASIC_CODE is missing on the server.");
    }
    throw new Error("Incorrect code");
  }

  return data as { ok: true };
}
