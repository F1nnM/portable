import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Creates an HMAC-SHA256 signed preview auth token.
 *
 * Format: `userId:slug:expiryUnix:hmacHex`
 */
export function createPreviewToken(
  userId: string,
  slug: string,
  key: string,
  ttlSeconds: number,
): string {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}:${slug}:${expiry}`;
  const hmac = createHmac("sha256", key).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

/**
 * Validates a preview auth token. Returns the userId if valid, null otherwise.
 *
 * Checks: format, HMAC signature (timing-safe), expiry, and slug binding.
 */
export function validatePreviewToken(
  token: string,
  expectedSlug: string,
  key: string,
): { userId: string } | null {
  if (!token) return null;

  const parts = token.split(":");
  if (parts.length !== 4) return null;

  const [userId, slug, expiryStr, hmacHex] = parts;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry)) return null;

  if (slug !== expectedSlug) return null;

  // Verify HMAC (timing-safe)
  const payload = `${userId}:${slug}:${expiryStr}`;
  const expected = createHmac("sha256", key).update(payload).digest("hex");

  if (expected.length !== hmacHex.length) return null;

  const isValid = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmacHex, "hex"));
  if (!isValid) return null;

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiry) return null;

  return { userId };
}
