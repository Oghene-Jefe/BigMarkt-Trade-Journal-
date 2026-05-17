// Magic-byte image type sniffer. The browser-reported `file.type` is
// trivial to spoof — an attacker can rename evil.html to evil.png and
// POST it with `Content-Type: image/png` in the multipart body. By the
// time it reaches Supabase Storage we've trusted that string, and the
// signed URL we hand back will be served with the spoofed Content-Type.
//
// This helper reads the first ~16 bytes of the file and matches against
// real magic numbers. It returns either a canonical MIME type or null
// for "this isn't an image we accept."

export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp";

const EXT_BY_TYPE: Record<SniffedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Map a sniffed MIME type to its canonical file extension. */
export function extForSniffedType(t: SniffedImageType): string {
  return EXT_BY_TYPE[t];
}

/**
 * Read the first bytes of a File and identify its real image type.
 * Returns null for anything that isn't one of the allow-listed formats.
 *
 * Allow-list: JPEG, PNG, WebP. GIF is intentionally NOT allowed because
 * (a) we don't render GIFs in the UI today and (b) GIF can carry JS
 * payloads in some viewers — easier to just reject than to validate.
 */
export async function sniffImageType(file: File): Promise<SniffedImageType | null> {
  if (!file || file.size < 12) return null;

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}
