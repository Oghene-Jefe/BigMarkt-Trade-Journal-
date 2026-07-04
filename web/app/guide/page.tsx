import Link from "next/link";
import type { Metadata, Route } from "next";
import { GUIDE_NAV } from "@/lib/guide/nav";

export const metadata: Metadata = { title: "Guide Home" };

export default function GuideHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">
        BigMarkt Guide
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Everything you need to journal, verify, and grow your trading record
        on BigMarkt.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GUIDE_NAV.map((group) => (
          <div
            key={group.label}
            className="rounded-lg border border-white/10 bg-panel p-5"
          >
            <h2 className="text-sm font-semibold text-white">{group.label}</h2>
            <ul className="mt-3 space-y-1.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    className="text-sm text-white/70 hover:text-gold"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
