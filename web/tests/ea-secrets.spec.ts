import { afterEach, beforeAll, describe, expect, it } from "vitest";

// The crypto module is `server-only`, but the import-time check is gated
// to NODE_ENV !== 'test'. Vitest sets it to 'test', so this import works.
// We still set a master key before any helper is called.

beforeAll(() => {
  // 32 random bytes, base64. Any deterministic value works for tests.
  process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY =
    "MDAwMTAyMDMwNDA1MDYwNzA4MDkwYTBiMGMwZDBlMGYxMDExMTIxMzE0MTUxNjE3MTgxOTFhMWIxYzFkMWUxZg==";
});

describe("ea/secrets encrypt/decrypt round-trip", () => {
  it("round-trips a fresh signing secret for the same user+token", async () => {
    const { encryptSigningSecret, decryptSigningSecret, generateSigningSecret } = await import(
      "@/lib/ea/secrets"
    );
    const secret = generateSigningSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);

    const userId = "user-1";
    const tokenId = "token-1";
    const blob = encryptSigningSecret(secret, userId, tokenId);
    expect(blob.keyVersion).toBe(1);
    expect(blob.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(blob.tag).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(blob.ciphertext).not.toContain(secret);

    expect(decryptSigningSecret(blob, userId, tokenId)).toBe(secret);
  });

  it("rejects decryption when userId is wrong (HKDF binding)", async () => {
    const { encryptSigningSecret, decryptSigningSecret, generateSigningSecret } = await import(
      "@/lib/ea/secrets"
    );
    const secret = generateSigningSecret();
    const blob = encryptSigningSecret(secret, "user-A", "token-1");
    expect(() => decryptSigningSecret(blob, "user-B", "token-1")).toThrow();
  });

  it("rejects decryption when tokenId is wrong (HKDF binding)", async () => {
    const { encryptSigningSecret, decryptSigningSecret, generateSigningSecret } = await import(
      "@/lib/ea/secrets"
    );
    const secret = generateSigningSecret();
    const blob = encryptSigningSecret(secret, "user-1", "token-A");
    expect(() => decryptSigningSecret(blob, "user-1", "token-B")).toThrow();
  });

  it("rejects decryption when the auth tag is tampered (GCM integrity)", async () => {
    const { encryptSigningSecret, decryptSigningSecret, generateSigningSecret } = await import(
      "@/lib/ea/secrets"
    );
    const secret = generateSigningSecret();
    const blob = encryptSigningSecret(secret, "user-1", "token-1");
    // Flip one byte in the tag (base64 alphabet swap)
    const badTag = blob.tag.replace(/^./, (c) => (c === "A" ? "B" : "A"));
    expect(() => decryptSigningSecret({ ...blob, tag: badTag }, "user-1", "token-1")).toThrow();
  });

  it("produces a different ciphertext for the same plaintext across calls (random IV)", async () => {
    const { encryptSigningSecret } = await import("@/lib/ea/secrets");
    const secret = "a".repeat(64);
    const blob1 = encryptSigningSecret(secret, "user-1", "token-1");
    const blob2 = encryptSigningSecret(secret, "user-1", "token-1");
    expect(blob1.iv).not.toBe(blob2.iv);
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
  });
});

// These tests temporarily mutate the env var — keep them in their own
// describe so beforeAll can capture/restore it cleanly.
describe("checkSigningSecretSetup — operational health probe", () => {
  const savedKey = process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY;
  afterEach(() => {
    process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY = savedKey;
  });

  it("reports ok when the env var is valid", async () => {
    const { checkSigningSecretSetup } = await import("@/lib/ea/secrets");
    expect(checkSigningSecretSetup()).toEqual({ ok: true });
  });

  it("reports not_set when env is missing", async () => {
    delete process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY;
    const { checkSigningSecretSetup } = await import("@/lib/ea/secrets");
    expect(checkSigningSecretSetup()).toEqual({ ok: false, reason: "not_set" });
  });

  it("reports too_short when env decodes to <32 bytes", async () => {
    // base64 of 8 bytes
    process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY = Buffer.from("12345678").toString("base64");
    const { checkSigningSecretSetup } = await import("@/lib/ea/secrets");
    expect(checkSigningSecretSetup()).toEqual({ ok: false, reason: "too_short" });
  });

  it("reports not_base64 for strings with characters outside the base64 alphabet", async () => {
    // The dollar sign is not in the base64 alphabet. Node's Buffer.from
    // would silently strip it; the tightened shape check rejects up front.
    process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY = "not$valid$base64!!@@##" + "A".repeat(40);
    const { checkSigningSecretSetup } = await import("@/lib/ea/secrets");
    expect(checkSigningSecretSetup()).toEqual({ ok: false, reason: "not_base64" });
  });

  it("reports not_base64 when stray junk bytes are silently stripped", async () => {
    // Valid 32-byte base64 with an embedded space (Buffer.from drops the
    // space and decodes the rest, which would otherwise pass).
    const valid = Buffer.from(new Uint8Array(32)).toString("base64");
    process.env.EA_SIGNING_SECRET_ENCRYPTION_KEY = valid.slice(0, 10) + " " + valid.slice(10);
    const { checkSigningSecretSetup } = await import("@/lib/ea/secrets");
    expect(checkSigningSecretSetup()).toEqual({ ok: false, reason: "not_base64" });
  });
});
