/**
 * Privacy / RLS tests. These hit a real Supabase project (test or staging)
 * using the env vars in .env.local. They prove every "Security Fixes From
 * Current Build" item in REBUILD_BRIEF is actually closed.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY     (used only to create + clean up fixtures)
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const haveEnv = Boolean(url && anonKey && serviceKey);
const d = haveEnv ? describe : describe.skip;

const anon = () => createClient(url!, anonKey!);
const admin = () => createClient(url!, serviceKey!, { auth: { persistSession: false } });

let userA: { id: string; email: string; password: string };
let userB: { id: string; email: string; password: string };

async function makeUser() {
  const email = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@bigmarkt.test`;
  const password = "test-password-123";
  const { data, error } = await admin().auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password };
}

beforeAll(async () => {
  if (!haveEnv) return;
  userA = await makeUser();
  userB = await makeUser();

  // Seed: A has a private trade and a private profile.
  await admin().from("profiles").upsert({ id: userA.id, email: userA.email, name: "Alice", visibility: "private" });
  await admin().from("profiles").upsert({ id: userB.id, email: userB.email, name: "Bob",   visibility: "community" });
  await admin().from("trades").insert({
    user_id: userA.id, pair: "EURUSD", direction: "BUY", result: "WIN", pnl: 100, visibility: "private",
  });
  await admin().from("trades").insert({
    user_id: userB.id, pair: "GBPUSD", direction: "SELL", result: "LOSS", pnl: -50, visibility: "private",
  });
});

afterAll(async () => {
  if (!haveEnv) return;
  for (const u of [userA, userB]) {
    if (u?.id) await admin().auth.admin.deleteUser(u.id);
  }
});

d("anonymous client", () => {
  it("cannot read profiles directly", async () => {
    const { data, error } = await anon().from("profiles").select("*");
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it("cannot read trades directly", async () => {
    const { data, error } = await anon().from("trades").select("*");
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it("get_leaderboard never returns email or raw trade rows", async () => {
    const { data, error } = await anon().rpc("get_leaderboard", { mode: "earners", lim: 50 });
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row).not.toHaveProperty("email");
      expect(row).not.toHaveProperty("pnl"); // raw trade-level PnL must not leak
      // Aggregate total_pnl is fine; per-row trade detail is not.
    }
  });

  it("get_leaderboard excludes private profiles", async () => {
    const { data } = await anon().rpc("get_leaderboard", { mode: "earners", lim: 50 });
    const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
    expect(ids.has(userA.id)).toBe(false); // private
  });
});

d("authenticated user A", () => {
  async function asA() {
    const c = anon();
    const { error } = await c.auth.signInWithPassword({ email: userA.email, password: userA.password });
    if (error) throw error;
    return c;
  }

  it("cannot read user B's profile", async () => {
    const c = await asA();
    const { data } = await c.from("profiles").select("*").eq("id", userB.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read user B's trades", async () => {
    const c = await asA();
    const { data } = await c.from("trades").select("*").eq("user_id", userB.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot update user B's profile", async () => {
    const c = await asA();
    const { data } = await c.from("profiles").update({ name: "hacked" }).eq("id", userB.id).select();
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot call admin_purge_user_data", async () => {
    const c = await asA();
    const { error } = await c.rpc("admin_purge_user_data", { target_id: userB.id });
    expect(error).not.toBeNull();
  });

  it("can read their own trades", async () => {
    const c = await asA();
    const { data } = await c.from("trades").select("*");
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const t of data ?? []) expect(t.user_id).toBe(userA.id);
  });
});
