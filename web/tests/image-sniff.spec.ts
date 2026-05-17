import { describe, expect, it } from "vitest";
import { extForSniffedType, sniffImageType } from "@/lib/upload/imageSniff";

// Construct a File from raw bytes. Vitest runs on Node — File is global.
function fileFromBytes(bytes: number[], name = "x", type = "application/octet-stream") {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("sniffImageType", () => {
  it("detects JPEG by FFD8FF magic, ignoring spoofed name/type", () => {
    // 16 bytes is the minimum the sniffer reads
    const jpeg = fileFromBytes([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1], "evil.png", "image/png");
    return expect(sniffImageType(jpeg)).resolves.toBe("image/jpeg");
  });

  it("detects PNG by 89 50 4E 47 0D 0A 1A 0A magic", () => {
    const png = fileFromBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0, 0, 0, 0], "x.jpg", "image/jpeg");
    return expect(sniffImageType(png)).resolves.toBe("image/png");
  });

  it("detects WebP by RIFF....WEBP", () => {
    const webp = fileFromBytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
    return expect(sniffImageType(webp)).resolves.toBe("image/webp");
  });

  it("rejects HTML masquerading as image/png", async () => {
    const html = "<html><script>alert(1)</script></html>".padEnd(32, " ");
    const fake = new File([html], "evil.png", { type: "image/png" });
    expect(await sniffImageType(fake)).toBeNull();
  });

  it("rejects GIF (intentionally not allow-listed)", async () => {
    const gif = fileFromBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(await sniffImageType(gif)).toBeNull();
  });

  it("rejects too-small files", async () => {
    const tiny = fileFromBytes([0xff, 0xd8, 0xff]);
    expect(await sniffImageType(tiny)).toBeNull();
  });

  it("extForSniffedType maps to canonical extensions", () => {
    expect(extForSniffedType("image/jpeg")).toBe("jpg");
    expect(extForSniffedType("image/png")).toBe("png");
    expect(extForSniffedType("image/webp")).toBe("webp");
  });
});
