import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, standard for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key

function parseKey(key: string): Buffer {
  if (!key) {
    throw new Error("Encryption key must not be empty");
  }

  const keyBuffer = Buffer.from(key, "hex");

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters), got ${keyBuffer.length} bytes`,
    );
  }

  return keyBuffer;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param key - Hex-encoded 32-byte (256-bit) encryption key
 * @returns Encrypted string in the format `iv:tag:ciphertext` (all base64-encoded)
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = parseKey(key);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    ":",
  );
}

/**
 * Decrypts a string previously encrypted with `encrypt()`.
 *
 * @param encrypted - The encrypted string in `iv:tag:ciphertext` format
 * @param key - Hex-encoded 32-byte (256-bit) encryption key (must match the key used to encrypt)
 * @returns The original plaintext string
 * @throws If the data has been tampered with, the key is wrong, or the format is invalid
 */
export function decrypt(encrypted: string, key: string): string {
  const keyBuffer = parseKey(key);

  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format: expected iv:tag:ciphertext");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
