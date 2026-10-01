import { NextRequest, NextResponse } from "next/server";
import { verifyBasicCode, verifyProCodeAndPassword } from "@/lib/security";

export const runtime = "nodejs";

// ─── Rate limiter ─────────────────────────────────────────────────
type RateEntry = { failures: number; resetAt: number };
const rateMap = new Map<string, RateEntry>();
const WINDOW_MS    = 15 * 60 * 1000; // 15 min
const MAX_FAILURES = process.env.NODE_ENV === "production" ? 5 : 50;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function getRateKey(ip: string, scope: string): string {
  return `${ip}:${scope}`;
}

function isLimited(key: string): false | number {
  const entry = rateMap.get(key);
  if (!entry) return false;
  if (Date.now() >= entry.resetAt) { rateMap.delete(key); return false; }
  if (entry.failures >= MAX_FAILURES) {
    return Math.ceil((entry.resetAt - Date.now()) / 60_000); // minutes remaining
  }
  return false;
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now >= entry.resetAt) {
    rateMap.set(key, { failures: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.failures += 1;
  }
}

// ─── Handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let scope: string;
  let code: string;
  let password: string | undefined;

  try {
    const body = await req.json();
    scope = body?.scope === "basic" ? "basic" : "pro";
    code = typeof body?.code === "string" ? body.code.trim() : "";
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rateKey = getRateKey(ip, scope);
  const retryAfterMin = isLimited(rateKey);
  
  if (retryAfterMin !== false) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: retryAfterMin },
      { status: 429 }
    );
  }

  const result = scope === "basic" 
    ? verifyBasicCode(code)
    : verifyProCodeAndPassword(code, password);

  if (result === "not_configured") {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  if (result === "wrong_code") {
    recordFailure(rateKey);
    return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  }

  // Success
  rateMap.delete(rateKey);
  return NextResponse.json({ ok: true });
}
