import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getModelForTier, type Tier } from "@/lib/models";
import { verifyBasicCode, verifyProCodeAndPassword } from "@/lib/security";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

export const runtime = "nodejs";

// ─── Tunable timeouts ────────────────────────────────────────────────
const FIRST_TOKEN_TIMEOUT_MS = 30_000; // abort if no first token in 30s
const IDLE_TOKEN_TIMEOUT_MS  = 45_000; // abort if no token for 45s mid-stream

// ─── Output guard patterns (extend this array freely) ────────────────
const TOOL_CALL_PATTERNS: (string | RegExp)[] = [
  /^\s*\{/,                   // starts with {
  /^```\s*json/i,             // starts with ```json
  "action_input",
  "tool_calls",
  "function_call",
  "tool_name",
  "dalle.text2im",
  "text2im",
  "image_gen",
];
const GUARD_BUFFER_CHARS = 150;
const GUARD_REPLACEMENT  = "This action isn't available in Nexa yet. I can only reply with text.";

// ─── Fast-path image-generation detector ────────────────────────────
// Only matches clear intent to CREATE an image, not to analyse/explain one.
const IMAGE_GEN_RE =
  /\b(?:generate|create|make|draw|paint|render|produce)\b.{0,60}\b(?:image|picture|photo|logo|illustration|drawing|artwork)\b/i;
const IMAGE_GEN_REPLY =
  "Image generation isn't available in Nexa yet. I can describe it in words or write a prompt for an image tool if you want.";

// ─── Types ────────────────────────────────────────────────────────────
type MessagePart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type ChatMessage = { role: "user" | "assistant" | "system"; content: string | MessagePart[] };
type Body = { tier: Tier; modelId: string; messages: ChatMessage[] };

// ─── Error classification ─────────────────────────────────────────────
type NexaErrorKind =
  | "unavailable"
  | "rate_limit"
  | "not_found"
  | "auth"
  | "safety"
  | "timeout";

interface NexaError {
  kind: NexaErrorKind;
  userMessage: string;
  /** Safe detail logged server-side only — never sent to client */
  detail?: string;
}

function classifyError(error: unknown, modelLabel: string): NexaError {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.status ?? (error as any)?.statusCode ?? 0;

  if (/timeout|timed out/i.test(msg) || code === 408 || code === 504) {
    return { kind: "timeout",    userMessage: `${modelLabel} is currently unavailable. Try again in a moment or switch to another model.`, detail: msg };
  }
  if (code === 429 || /rate.limit|too many requests/i.test(msg)) {
    return { kind: "rate_limit", userMessage: `${modelLabel} is busy right now. Try again shortly or switch model.`, detail: msg };
  }
  if (code === 404 || /model.not.found|not.found/i.test(msg)) {
    return { kind: "not_found",  userMessage: `${modelLabel} is no longer available. Please pick another model.`, detail: msg };
  }
  if (code === 401 || code === 403 || /api.key|unauthorized|authentication/i.test(msg)) {
    return { kind: "auth",       userMessage: `${modelLabel} isn't available right now.`, detail: `Auth error — check your API key env var. ${msg}` };
  }
  if (/safety|blocked|content.filter|policy/i.test(msg)) {
    return { kind: "safety",     userMessage: "That request was blocked by the model's safety filters. Try rephrasing.", detail: msg };
  }
  if (code >= 500 || /overloaded|server.error|unavailable/i.test(msg)) {
    return { kind: "unavailable",userMessage: `${modelLabel} is currently unavailable. Try again in a moment or switch to another model.`, detail: msg };
  }
  return { kind: "unavailable",  userMessage: `${modelLabel} is currently unavailable. Try again in a moment or switch to another model.`, detail: msg };
}

function apiKey(provider: "openai" | "deepseek" | "gemini" | "anthropic") {
  if (provider === "openai")   return process.env.OPENAI_API_KEY;
  if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  return process.env.GEMINI_API_KEY;
}

function keyEnvVar(provider: "openai" | "deepseek" | "gemini" | "anthropic") {
  if (provider === "openai")   return "OPENAI_API_KEY";
  if (provider === "deepseek") return "DEEPSEEK_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  return "GEMINI_API_KEY";
}

function createClient(provider: "openai" | "deepseek" | "gemini" | "anthropic") {
  const key = apiKey(provider);
  if (!key) throw Object.assign(new Error(`Missing ${keyEnvVar(provider)}`), { status: 401 });
  if (provider === "anthropic") return new Anthropic({ apiKey: key });
  if (provider === "deepseek") return new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });
  if (provider === "gemini")   return new OpenAI({ apiKey: key, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
  return new OpenAI({ apiKey: key });
}

function validMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) return false;
  return messages.every((message) => {
    if (!message || typeof message !== "object") return false;
    const item = message as ChatMessage;
    if (!["user", "assistant", "system"].includes(item.role)) return false;
    if (typeof item.content === "string") return true;
    return Array.isArray(item.content) && item.content.every((part) => {
      if (part?.type === "text")      return typeof part.text === "string";
      if (part?.type === "image_url") return typeof part.image_url?.url === "string" && part.image_url.url.startsWith("data:image/");
      return false;
    });
  });
}

/** Returns true if the buffered prefix looks like a tool/JSON call */
function looksLikeToolCall(text: string): boolean {
  for (const pat of TOOL_CALL_PATTERNS) {
    if (typeof pat === "string" && text.includes(pat)) return true;
    if (pat instanceof RegExp && pat.test(text))       return true;
  }
  return false;
}

/** Return a plain-text streaming response for a canned message */
function cannedResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) { ctrl.enqueue(encoder.encode(text)); ctrl.close(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

/** Return a structured JSON error response the client can classify */
function errorResponse(nexaError: NexaError, status = 502): NextResponse {
  if (nexaError.detail) console.error(`[nexa/chat] ${nexaError.kind}: ${nexaError.detail}`);
  return NextResponse.json({ error: nexaError.userMessage, kind: nexaError.kind }, { status });
}

export async function POST(request: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────
  let body: Body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  if (!["basic", "pro"].includes(body.tier)) return NextResponse.json({ error: "Invalid tier." }, { status: 400 });

  // ── Auth ──────────────────────────────────────────────────────
  const basicCode = request.headers.get("x-basic-code") ?? undefined;
  if (verifyBasicCode(basicCode) !== "ok") {
    return NextResponse.json({ error: "Basic authentication failed.", kind: "auth" }, { status: 401 });
  }

  if (body.tier === "pro") {
    const proCode = request.headers.get("x-pro-code") ?? undefined;
    const proPass = request.headers.get("x-pro-password") ?? undefined;
    if (verifyProCodeAndPassword(proCode, proPass) !== "ok") {
      return NextResponse.json({ error: "Pro authentication failed.", kind: "auth" }, { status: 401 });
    }
  }

  const model = getModelForTier(body.tier, body.modelId);
  if (!model) return NextResponse.json({ error: "Invalid model for the selected tier." }, { status: 400 });
  if (!validMessages(body.messages)) return NextResponse.json({ error: "Invalid messages." }, { status: 400 });

  // ── Vision guard ──────────────────────────────────────────────────
  const hasImages = body.messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
  if (hasImages && !model.vision) return NextResponse.json({ error: "The selected model does not support images." }, { status: 400 });

  // ── Fast-path: image generation request (layer 3) ─────────────────
  const lastUserText = [...body.messages].reverse().find((m) => m.role === "user");
  const latestText = typeof lastUserText?.content === "string" ? lastUserText.content : "";
  if (!hasImages && IMAGE_GEN_RE.test(latestText)) {
    return cannedResponse(IMAGE_GEN_REPLY);
  }

  // ── Build messages with system prompt prepended ───────────────────
  // PROMPT CACHING: The exact order and serialisation of these messages must
  // stay perfectly stable (System -> old messages -> new message) so the cache hits.
  const systemMessage: ChatMessage = { role: "system", content: SYSTEM_PROMPT };
  // Exclude any ui-only flagged messages before sending (handled client-side via filtering)
  const fullMessages: ChatMessage[] = [systemMessage, ...body.messages];

  // ── Create client ─────────────────────────────────────────────────
  let client: OpenAI | Anthropic;
  try { client = createClient(model.provider); }
  catch (error) {
    const ne = classifyError(error, model.label);
    if (ne.detail) console.error(`[nexa/chat] missing key: ${ne.detail}`);
    return errorResponse(ne, 500);
  }

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });

  let completion: AsyncIterable<any>;

  if (model.provider === "anthropic") {
    const anthropicClient = client as Anthropic;
    const systemMsg = fullMessages.find((m) => m.role === "system")?.content as string | undefined;
    const history = fullMessages.filter((m) => m.role !== "system");

    const anthropicMessages: Anthropic.MessageParam[] = history.map((m, index) => {
      const isLastBeforeNewUserMsg = index === history.length - 2;
      if (typeof m.content === "string") {
        return {
          role: m.role as "user" | "assistant",
          content: [
            { type: "text", text: m.content, ...(isLastBeforeNewUserMsg ? { cache_control: { type: "ephemeral" } } : {}) }
          ]
        };
      } else {
        const content = m.content.map((part, partIdx) => {
          const isLastPart = partIdx === m.content.length - 1;
          const addCache = isLastBeforeNewUserMsg && isLastPart;
          if (part.type === "text") {
            return { type: "text", text: part.text, ...(addCache ? { cache_control: { type: "ephemeral" } } : {}) };
          } else {
            const b64 = part.image_url.url.split(",")[1];
            const media_type = part.image_url.url.split(";")[0].split(":")[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
            return { type: "image", source: { type: "base64", media_type, data: b64 }, ...(addCache ? { cache_control: { type: "ephemeral" } } : {}) };
          }
        }) as Anthropic.MessageParam["content"];
        return { role: m.role as "user" | "assistant", content };
      }
    });

    try {
      const stream = await anthropicClient.messages.stream({
        model: model.apiModel,
        max_tokens: 4096,
        system: systemMsg ? [{ type: "text", text: systemMsg, cache_control: { type: "ephemeral" } }] : undefined,
        messages: anthropicMessages,
      }, { signal: controller.signal });

      completion = (async function* () {
        for await (const chunk of stream) {
          if (chunk.type === "message_start") {
            const cached = chunk.message.usage?.cache_read_input_tokens;
            if (cached) yield { usage: { prompt_cache_hit_tokens: cached } };
          }
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            yield { choices: [{ delta: { content: chunk.delta.text } }] };
          }
        }
      })();
    } catch (firstError) {
      return errorResponse(classifyError(firstError, model.label));
    }
  } else {
    const openaiClient = client as OpenAI;
    const isReasoning = model.reasoning === true;
    const base: Record<string, unknown> = {
      model: model.apiModel,
      messages: fullMessages,
      stream: true,
      stream_options: { include_usage: true }, // Required for token usage in chunks
    };
    if (isReasoning) { base.max_completion_tokens = 4096; base.reasoning_effort = "low"; }
    else             { base.max_tokens = 4096; }
    if (model.provider === "deepseek") base.extra_body = { thinking: { type: "disabled" } };

    try {
      completion = (await openaiClient.chat.completions.create(base as any, { signal: controller.signal })) as any;
    } catch (firstError) {
      if (!isReasoning) return errorResponse(classifyError(firstError, model.label));
      const retry = { ...base }; delete retry.reasoning_effort;
      try { completion = (await openaiClient.chat.completions.create(retry as any, { signal: controller.signal })) as any; }
      catch (retryError) { return errorResponse(classifyError(retryError, model.label)); }
    }
  }

  // ── Streaming with output guard + timeouts ────────────────────────
  const encoder = new TextEncoder();
  let firstTokenTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer:       ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    if (idleTimer)       clearTimeout(idleTimer);
    firstTokenTimer = null;
    idleTimer = null;
  }

  function resetIdleTimer(onTimeout: () => void) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.error(`[nexa/chat] idle timeout (${IDLE_TOKEN_TIMEOUT_MS}ms)`);
      onTimeout();
    }, IDLE_TOKEN_TIMEOUT_MS);
  }

  const stream = new ReadableStream({
    async start(ctrl) {
      // Start first-token timer
      firstTokenTimer = setTimeout(() => {
        console.error(`[nexa/chat] first-token timeout (${FIRST_TOKEN_TIMEOUT_MS}ms)`);
        controller.abort();
        ctrl.error(Object.assign(new Error("timeout"), { status: 504 }));
      }, FIRST_TOKEN_TIMEOUT_MS);

      let buffer    = "";
      let guarded   = false;   // true once buffer has been flushed / rejected
      let hasTokens = false;   // true once we've received real content

      try {
        for await (const chunk of completion) {
          if (controller.signal.aborted) break;

          // Log cached token usage if present
          if (chunk.usage) {
            const cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? (chunk.usage as any).prompt_cache_hit_tokens;
            if (cachedTokens) {
              console.log(`[nexa/chat] cached tokens used: ${cachedTokens}`);
            }
          }

          const text: string = typeof chunk?.choices?.[0]?.delta?.content === "string"
            ? chunk.choices[0].delta.content : "";
          if (!text) continue;

          // First token: cancel first-token timer, start idle timer
          if (!hasTokens) {
            hasTokens = true;
            if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
            resetIdleTimer(() => { controller.abort(); });
          } else {
            resetIdleTimer(() => { controller.abort(); });
          }

          if (!guarded) {
            buffer += text;
            if (buffer.length >= GUARD_BUFFER_CHARS) {
              // Enough buffered — decide now
              guarded = true;
              if (looksLikeToolCall(buffer)) {
                ctrl.enqueue(encoder.encode(GUARD_REPLACEMENT));
                controller.abort(); // stop the upstream stream
              } else {
                ctrl.enqueue(encoder.encode(buffer));
              }
            }
            // else: keep buffering
          } else {
            // Already flushed, stream normally (upstream may be aborted)
            if (!controller.signal.aborted) ctrl.enqueue(encoder.encode(text));
          }
        }

        // Stream ended — flush any remaining buffer
        if (!guarded && buffer) {
          guarded = true;
          if (looksLikeToolCall(buffer)) {
            ctrl.enqueue(encoder.encode(GUARD_REPLACEMENT));
          } else {
            ctrl.enqueue(encoder.encode(buffer));
          }
        }

        clearTimers();
        ctrl.close();
      } catch (error) {
        clearTimers();
        if (controller.signal.aborted) {
          // If we already sent some content, append interrupted note
          if (hasTokens) {
            ctrl.enqueue(encoder.encode("\n\n_Response interrupted._"));
            ctrl.close();
          } else {
            ctrl.close();
          }
          return;
        }
        const ne = classifyError(error, model.label);
        if (ne.detail) console.error(`[nexa/chat] stream error: ${ne.detail}`);
        // If we've already sent tokens, append interrupted note; otherwise propagate error
        if (hasTokens) {
          ctrl.enqueue(encoder.encode("\n\n_Response interrupted._"));
          ctrl.close();
        } else {
          ctrl.error(Object.assign(new Error(JSON.stringify({ error: ne.userMessage, kind: ne.kind })), { isNexaError: true }));
        }
      }
    },
    cancel() {
      clearTimers();
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
