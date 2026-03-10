import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRelayToken, verifyRelayToken } from "../../server/utils/relay-token";

const KEY = "a".repeat(64); // 32-byte hex key

describe("relay-token", () => {
  it("creates and verifies a valid token", () => {
    const token = createRelayToken("session-abc-123", KEY);
    const result = verifyRelayToken(token, KEY);
    expect(result).toEqual({ sessionId: "session-abc-123" });
  });

  it("rejects a token signed with a different key", () => {
    const token = createRelayToken("session-abc-123", KEY);
    const otherKey = "b".repeat(64);
    expect(verifyRelayToken(token, otherKey)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createRelayToken("session-abc-123", KEY);
    const parts = token.split(".");
    parts[0] = "tampered-session";
    expect(verifyRelayToken(parts.join("."), KEY)).toBeNull();
  });

  it("rejects a token with wrong format", () => {
    expect(verifyRelayToken("not-a-valid-token", KEY)).toBeNull();
    expect(verifyRelayToken("", KEY)).toBeNull();
    expect(verifyRelayToken("a.b", KEY)).toBeNull();
    expect(verifyRelayToken("a.b.c.d", KEY)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createRelayToken("session-abc-123", KEY);
    // Manipulate the timestamp to be 2 minutes ago
    const parts = token.split(".");
    parts[1] = (Date.now() - 120_000).toString();
    // Re-sign with correct key (simulate an old but validly signed token)
    const payload = `${parts[0]}.${parts[1]}`;
    const sig = createHmac("sha256", KEY).update(payload).digest("base64url");
    const expiredToken = `${payload}.${sig}`;
    expect(verifyRelayToken(expiredToken, KEY)).toBeNull();
  });
});
