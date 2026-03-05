import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../server/utils/crypto";

function generateKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

describe("credential encryption utility", () => {
  const key = generateKey();

  it("encrypts and decrypts a string round-trip", () => {
    const plaintext = "sk-ant-api03-secret-key-value";
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("different inputs produce different ciphertexts", () => {
    const encrypted1 = encrypt("secret-one", key);
    const encrypted2 = encrypt("secret-two", key);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("same input encrypted twice produces different ciphertexts (random IV)", () => {
    const plaintext = "same-input-every-time";
    const encrypted1 = encrypt(plaintext, key);
    const encrypted2 = encrypt(plaintext, key);
    expect(encrypted1).not.toBe(encrypted2);
    // Both should still decrypt to the same value
    expect(decrypt(encrypted1, key)).toBe(plaintext);
    expect(decrypt(encrypted2, key)).toBe(plaintext);
  });

  it("tampered ciphertext fails decryption", () => {
    const encrypted = encrypt("sensitive-data", key);
    // The format is iv:tag:ciphertext in base64, tamper with the ciphertext portion
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);

    // Flip a character in the ciphertext (last part)
    const ciphertextBytes = Buffer.from(parts[2], "base64");
    ciphertextBytes[0] ^= 0xff;
    parts[2] = ciphertextBytes.toString("base64");
    const tampered = parts.join(":");

    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("wrong key fails decryption", () => {
    const encrypted = encrypt("my-secret", key);
    const wrongKey = generateKey();
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("throws on empty key for encrypt", () => {
    expect(() => encrypt("data", "")).toThrow();
  });

  it("throws on empty key for decrypt", () => {
    const encrypted = encrypt("data", key);
    expect(() => decrypt(encrypted, "")).toThrow();
  });

  it("throws on invalid key length", () => {
    expect(() => encrypt("data", "abcd")).toThrow();
  });

  it("encrypts and decrypts empty string correctly", () => {
    const encrypted = encrypt("", key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe("");
  });

  it("handles unicode content", () => {
    const plaintext = "Hello, world! Clave secreta.";
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });
});
