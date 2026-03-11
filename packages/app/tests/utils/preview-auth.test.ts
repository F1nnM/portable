import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPreviewToken, validatePreviewToken } from "../../server/utils/preview-auth";

function generateKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

describe("preview auth tokens", () => {
  const key = generateKey();
  const userId = "user-123";
  const slug = "my-project";

  it("creates and validates a token round-trip", () => {
    const token = createPreviewToken(userId, slug, key, 300);
    const result = validatePreviewToken(token, slug, key);
    expect(result).toEqual({ userId });
  });

  it("rejects an expired token", () => {
    const token = createPreviewToken(userId, slug, key, -1);
    const result = validatePreviewToken(token, slug, key);
    expect(result).toBeNull();
  });

  it("rejects a token with wrong slug", () => {
    const token = createPreviewToken(userId, slug, key, 300);
    const result = validatePreviewToken(token, "other-project", key);
    expect(result).toBeNull();
  });

  it("rejects a token with tampered HMAC", () => {
    const token = createPreviewToken(userId, slug, key, 300);
    const parts = token.split(":");
    // Flip a character in the HMAC (last part)
    parts[3] = parts[3].replace(/^./, parts[3][0] === "a" ? "b" : "a");
    const tampered = parts.join(":");
    const result = validatePreviewToken(tampered, slug, key);
    expect(result).toBeNull();
  });

  it("rejects a malformed token (too few parts)", () => {
    const result = validatePreviewToken("only:two", slug, key);
    expect(result).toBeNull();
  });

  it("rejects a malformed token (empty string)", () => {
    const result = validatePreviewToken("", slug, key);
    expect(result).toBeNull();
  });

  it("rejects a token with non-numeric expiry", () => {
    const hmac = crypto.createHmac("sha256", key).update(`${userId}:${slug}:abc`).digest("hex");
    const result = validatePreviewToken(`${userId}:${slug}:abc:${hmac}`, slug, key);
    expect(result).toBeNull();
  });

  it("rejects a token signed with a different key", () => {
    const token = createPreviewToken(userId, slug, key, 300);
    const otherKey = generateKey();
    const result = validatePreviewToken(token, slug, otherKey);
    expect(result).toBeNull();
  });

  it("token format is userId:slug:expiry:hmac", () => {
    const token = createPreviewToken(userId, slug, key, 300);
    const parts = token.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(userId);
    expect(parts[1]).toBe(slug);
    expect(Number(parts[2])).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
  });
});
