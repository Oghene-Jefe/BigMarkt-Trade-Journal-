import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  deleteBrokerAction,
  toggleBrokerActiveAction,
  toggleBrokerRecommendedAction,
} from "../actions";
import ConfirmButton from "@/components/ConfirmButton";
import BrokerForm from "./BrokerForm";

export const dynamic = "force-dynamic";

type Broker = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  is_recommended: boolean;
  is_active: boolean;
  sort_order: number;
};

function truncate(s: string | null, n = 50): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function AdminBrokersPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const { data } = await sb
    .from("brokers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const brokers = (data ?? []) as Broker[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-widest text-gold">
          BROKER MANAGEMENT
        </h1>
        <p className="text-xs text-muted">
          {brokers.length} broker{brokers.length === 1 ? "" : "s"} ·{" "}
          {brokers.filter((b) => b.is_active).length} active
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-sm tracking-widest text-gold">
          ADD BROKER
        </h2>
        <BrokerForm />
      </section>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Website</th>
              <th className="px-3 py-2 text-center">Rec.</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 text-right">Sort</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brokers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-muted">
                  No brokers yet.
                </td>
              </tr>
            ) : (
              brokers.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logo_url}
                        alt=""
                        className="h-8 w-8 rounded object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#D4AF37", color: "#000", fontWeight: 700, fontSize: 12 }}
                      >
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-white">{b.name}</div>
                    {b.description ? (
                      <div className="text-xs text-muted">{truncate(b.description)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {b.website_url ? (
                      <a
                        href={b.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-gold"
                      >
                        {truncate(b.website_url, 32)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <form action={toggleBrokerRecommendedAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button
                        type="submit"
                        title="Toggle recommended"
                        className={`rounded px-2 py-0.5 text-xs ${
                          b.is_recommended
                            ? "bg-gold/20 text-gold"
                            : "bg-white/5 text-muted"
                        }`}
                      >
                        ★ {b.is_recommended ? "Yes" : "No"}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <form action={toggleBrokerActiveAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button
                        type="submit"
                        className={`rounded px-2 py-0.5 text-xs ${
                          b.is_active
                            ? "bg-win/20 text-win"
                            : "bg-loss/20 text-loss"
                        }`}
                      >
                        {b.is_active ? "Active" : "Hidden"}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.sort_order}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteBrokerAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton
                        message={`Delete broker "${b.name}"? This cannot be undone.`}
                        className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
