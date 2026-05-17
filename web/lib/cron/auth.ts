// Shared auth for cron routes. Vercel cron sets the
// `Authorization: Bearer ${CRON_SECRET}` header automatically on every
// scheduled invocation; we verify it here.
//
// Two audit findings closed:
//   • H-8: comparison is constant-time via `crypto.timingSafeEqual` after
//     length-equalisation. Prior code used `!==` which short-circuits
//     at the first mismatching byte, leaking the secret one byte at a
//     time over a sustained probe.
//   • H-9: the calling routes return a generic `{error:"Internal error"}`
//     for downstream failures rather than echoing raw `error.message`
//     from supabase/postgres, which leaked schema and RLS policy names
//     to anyone who could authenticate (or to whoever scrapes Vercel
//     logs after a future log-aggregator change).
//
// `server-only` makes accidental client import a build error.
import "server-only";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function verifyCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  // Length pre-check keeps timingSafeEqual on equal-length buffers (it
  // throws otherwise). Length itself is non-secret information; the
  // important property — that mismatching SECRETS don't leak position
  // via timing — is preserved.
  if (provided.length !== expected.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
