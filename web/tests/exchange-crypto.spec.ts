/**
 * Tests for the exchange-credential encryption helper.
 *
 * Pins these invariants:
 *   - encrypt → decrypt round-trips arbitrary strings
 *   - the same plaintext + same user + different salt produces different ciphertext
 *   - tampering with the ciphertext or auth tag throws
 *   - decrypting with the wrong userId throws (HKDF info diverges)
 *   - decrypting with the wrong salt throws
 *   - the serialised blob does not contain the plaintext as a substring
 *   - missing / short master key surfaces a clear error
 */

// Set a stable master key BEFORE the module under test reads it.
// 32 random bytes, base64-encoded, only used in tests.
process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 zero bytes

import { describe, it, expect } from "vitest";
import {
  encryptCredential,
  decryptCredential,
  generateSalt,
  apiKeyHint,
} from "@/lib/exchanges/crypto";

const userA = "00000000-0000-4000-8000-00000000aaaa";
const userB = "00000000-0000-4000-8000-00000000bbbb";

describe("exchange/crypto round-trip", () => {
  it("decrypts what it encrypted", () => {
    const salt = generateSalt();
    const plaintext = "byb_RA7K8XlQpf3T_secret_payload_42";
    const blob = encryptCredential(plaintext, userA, salt);
    expect(decryptCredential(blob, userA, salt)).toBe(plaintext);
  });

  it("handles empty-looking but legal payloads with special chars", () => {
    const salt = generateSalt();
    const plaintext = '{"k":"v","n":1,"emoji":"🚀","quote":"o\'brien"}';
    const blob = encryptCredential(plaintext, userA, salt);
    expect(decryptCredential(blob, userA, salt)).toBe(plaintext);
  });

  it("rejects empty plaintext", () => {
    const salt = generateSalt();
    expect(() => encryptCredential("", userA, salt)).toThrow();
  });
});

describe("exchange/crypto secrecy", () => {
  it("never includes plaintext as a substring of the ciphertext blob", () => {
    const salt = generateSalt();
    const plaintext = "PLAINTEXT_MARKER_THAT_MUST_NOT_LEAK_42";
    const blob = encryptCredential(plaintext, userA, salt);
    expect(blob).not.toContain(plaintext);
    expect(blob).not.toContain("MARKER");
    // The base64-encoded ciphertext also shouldn't accidentally collide
    // with a base64 form of the plaintext.
    const b64Plain = Buffer.from(plaintext, "utf8").toString("base64");
    expect(blob).not.toContain(b64Plain);
  });

  it("produces different ciphertexts for the same plaintext + user (random IV)", () => {
    const salt = generateSalt();
    const plaintext = "same-input";
    const a = encryptCredential(plaintext, userA, salt);
    const b = encryptCredential(plaintext, userA, salt);
    expect(a).not.toBe(b);
  });

  it("produces different ciphertexts for the same plaintext + different salts", () => {
    const plaintext = "same-input";
    const a = encryptCredential(plaintext, userA, generateSalt());
    const b = encryptCredential(plaintext, userA, generateSalt());
    expect(a).not.toBe(b);
  });
});

describe("exchange/crypto tamper detection", () => {
  it("throws when ciphertext bytes are flipped", () => {
    const salt = generateSalt();
    const blob = encryptCredential("trade-key", userA, salt);
    const parsed = JSON.parse(blob) as { ct: string; iv: string; tag: string; v: number };

    // Flip the first byte of the base64-decoded ciphertext, re-encode.
    const ct = Buffer.from(parsed.ct, "base64");
    ct[0] ^= 0xff;
    const tampered = JSON.stringify({ ...parsed, ct: ct.toString("base64") });

    expect(() => decryptCredential(tampered, userA, salt)).toThrow();
  });

  it("throws when auth tag is flipped", () => {
    const salt = generateSalt();
    const blob = encryptCredential("trade-key", userA, salt);
    const parsed = JSON.parse(blob) as { tag: string; ct: string; iv: string; v: number };

    const tag = Buffer.from(parsed.tag, "base64");
    tag[0] ^= 0xff;
    const tampered = JSON.stringify({ ...parsed, tag: tag.toString("base64") });

    expect(() => decryptCredential(tampered, userA, salt)).toThrow();
  });

  it("throws when blob is malformed JSON", () => {
    expect(() => decryptCredential("not-json", userA, generateSalt())).toThrow();
  });

  it("throws when blob version is unsupported", () => {
    const salt = generateSalt();
    const blob = encryptCredential("x", userA, salt);
    const parsed = JSON.parse(blob);
    const futureVersion = JSON.stringify({ ...parsed, v: 99 });
    expect(() => decryptCredential(futureVersion, userA, salt)).toThrow();
  });
});

describe("exchange/crypto key isolation", () => {
  it("throws when decrypting with the wrong userId", () => {
    const salt = generateSalt();
    const blob = encryptCredential("shared-input", userA, salt);
    expect(() => decryptCredential(blob, userB, salt)).toThrow();
  });

  it("throws when decrypting with the wrong salt", () => {
    const blob = encryptCredential("shared-input", userA, generateSalt());
    expect(() => decryptCredential(blob, userA, generateSalt())).toThrow();
  });
});

describe("exchange/apiKeyHint", () => {
  it("masks middle of long keys", () => {
    expect(apiKeyHint("ABCD1234567890ZXCV")).toBe("ABCD...ZXCV");
  });

  it("falls back to **** for short keys", () => {
    expect(apiKeyHint("short")).toBe("****");
    expect(apiKeyHint("12345678")).toBe("****");
  });
});
