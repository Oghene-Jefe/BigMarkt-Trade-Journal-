// Pure parsing helpers for the GET /status request. Extracted so the
// validation logic is unit-testable without spinning up the HTTP server.
//
// Contract: the journal sends the calling user's active EA token IDs as a
// comma-separated list in ?token_ids=. The WS server uses that list as an
// allow-list when filtering its in-memory authedSockets — clients whose
// tokenId is not in the list are never surfaced.
//
// Why caller-supplied rather than server-derived: the WS server has no
// notion of journal users; it only knows about EA tokens. Trust boundary:
// the journal (gated by WS_STATUS_SECRET) is the only caller, so it's the
// natural place to enforce "this user's tokens, please."

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hard cap. A user with more than this many active tokens is either
// abusing the system or has a bug; either way, no reason to spend cycles
// matching against an unbounded list per request.
const MAX_IDS = 200;

/**
 * Parse and validate the `?token_ids=` query param.
 *
 *   - Returns an array of unique, lowercased UUIDs.
 *   - Empty / missing param → returns [].
 *   - Junk entries (non-UUID strings, "undefined", extra commas) are
 *     silently dropped — we don't want a single malformed entry to fail
 *     the whole status poll.
 *   - Caps at MAX_IDS to avoid pathological inputs.
 */
export function parseTokenIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const v = part.trim().toLowerCase();
    if (!v || !UUID_RE.test(v)) continue;
    seen.add(v);
    if (seen.size >= MAX_IDS) break;
  }
  return Array.from(seen);
}
