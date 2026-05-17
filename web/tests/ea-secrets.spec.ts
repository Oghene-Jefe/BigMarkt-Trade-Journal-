import { beforeAll, describe, expect, it } from "vitest";

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
