import crypto from "crypto";

// Hash a value with SHA-256 so timingSafeEqual always compares equal-length buffers.
function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

/**
 * Timing-safe comparison of two strings.
 * Returns false if either is falsy (avoids length-mismatch crash by hashing first).
 */
export function safeCompare(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  return crypto.timingSafeEqual(sha256(provided), sha256(expected));
}

/**
 * Verify Basic combination code.
 */
export function verifyBasicCode(code: string | undefined): "ok" | "wrong_code" | "not_configured" {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE === "true") {
    return code?.trim().length === 6 ? "ok" : "wrong_code";
  }

  const expected = process.env.BASIC_CODE?.trim();
  if (!expected) return "not_configured";
  if (!code) return "wrong_code";
  return safeCompare(code.trim(), expected) ? "ok" : "wrong_code";
}

/**
 * Verify Pro code AND password.
 */
export function verifyProCodeAndPassword(
  code: string | undefined,
  password: string | undefined
): "ok" | "wrong_code" | "not_configured" {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE === "true") {
    const codeOk = code?.trim().length === 6;
    const passOk = typeof password === "string" && password.length > 0;
    return (codeOk && passOk) ? "ok" : "wrong_code";
  }

  const expectedCode = process.env.PRO_CODE?.trim();
  const expectedPass = process.env.PRO_PASSWORD;
  
  if (!expectedCode || !expectedPass) return "not_configured";
  if (!code || typeof password !== "string") return "wrong_code";

  const codeMatch = safeCompare(code.trim(), expectedCode);
  const passMatch = safeCompare(password.normalize("NFC"), expectedPass.normalize("NFC"));

  return (codeMatch && passMatch) ? "ok" : "wrong_code";
}
