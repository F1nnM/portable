import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

const RELAY_TOKEN_TTL_MS = 60_000; // 60 seconds

/**
 * Creates a signed relay token that binds a session ID to a timestamp.
 * Used by the auth relay flow to transfer authentication from the main app
 * domain to a project subdomain without sharing cookies across domains.
 *
 * Format: `<sessionId>.<timestamp>.<signature>`
 */
export function createRelayToken(sessionId: string, encryptionKey: string): string {
  const timestamp = Date.now().toString();
  const payload = `${sessionId}.${timestamp}`;
  const sig = createHmac("sha256", encryptionKey).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verifies a relay token and extracts the session ID.
 * Returns null if the token is invalid, expired, or tampered with.
 */
export function verifyRelayToken(
  token: string,
  encryptionKey: string,
): { sessionId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [sessionId, timestampStr, sig] = parts;
  if (!sessionId || !timestampStr || !sig) return null;

  // Verify signature
  const payload = `${sessionId}.${timestampStr}`;
  const expectedSig = createHmac("sha256", encryptionKey).update(payload).digest("base64url");

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  // Check expiry
  const timestamp = Number.parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp) || Date.now() - timestamp > RELAY_TOKEN_TTL_MS) return null;

  return { sessionId };
}
