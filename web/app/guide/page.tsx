import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { GUIDE_NAV } from "@/lib/guide/nav";

export const metadata: Metadata = { title: "Guide Home" };

const DESCRIPTIONS: Record<string, string> = {
  "Getting Started": "Create your account and set up your profile.",
  "Journaling Trades": "Log trades manually and manage visibility.",
  "Verified Auto-Capture": "Connect your broker for broker-verified trades.",
  "Trading Tools": "Position sizing, rules, and goal tracking.",
  "Analytics & Reports": "Charts, breakdowns, and shareable reports.",
  "Community & Social": "Follow leaders, react, and check the leaderboard.",
  Notifications: "Stay on top of alerts from leaders you follow.",
  "Plans & Referrals": "Free vs Pro, and your referral link.",
  "Security & Privacy": "How your data is protected, public vs private.",
  Help: "FAQ and how to reach support.",
};

export default function GuideHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">
        BigMarkt Guide
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Everything you need to journal, verify, and grow your trading
        record on BigMarkt. Use the sidebar to jump anywhere, or start
        here.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GUIDE_NAV.map((group) => {
          const first = group.items[0];
          return (
            <div
              key={group.label}
              className="flex flex-col justify-between rounded-lg border border-white/10 bg-panel p-5"
            >
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {group.label}
                </h2>
                <p className="mt-1.5 text-xs text-muted">
                  {DESCRIPTIONS[group.label] ?? ""}
                </p>
              </div>
              {first ? (
                <Link
                  href={first.href as Route}
                  className="mt-4 inline-block text-sm text-gold hover:underline"
                >
                  Start here &rarr;
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
