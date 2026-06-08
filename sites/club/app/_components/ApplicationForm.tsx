"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitApplication, type ApplicationState } from "../actions";
import Turnstile from "./Turnstile";

const initial: ApplicationState = { ok: false };

const fieldClass =
  "w-full border border-[#1f1f1f] bg-[#111111] px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#C9A84C] focus:outline-none";
const labelClass = "block text-xs font-semibold uppercase tracking-widest text-white/60";

const TRACKS = [
  "Money Foundations",
  "Investing Fundamentals",
  "Crypto & Digital Assets",
  "Business Finance",
  "Global Markets",
  "Trading Track",
];

const TYPE_VALUES = ["member", "chapter", "mentor"] as const;
type AppType = (typeof TYPE_VALUES)[number];

export default function ApplicationForm() {
  const [state, formAction, pending] = useActionState(submitApplication, initial);
  const params = useSearchParams();
  const requestedType = params.get("type");
  const initialType = TYPE_VALUES.includes(requestedType as AppType)
    ? (requestedType as AppType)
    : "member";
  const [appType, setAppType] = useState<AppType>(initialType);

  if (state.ok) {
    return (
      <div className="border border-[#C9A84C] bg-[#111111] p-8">
        <h3 className="text-2xl font-bold text-[#C9A84C]">Application Received</h3>
        <p className="mt-4 text-white/80">
          Application received. You will hear from us within 7 to 10 days.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <div>
        <label htmlFor="full_name" className={labelClass}>Full Name *</label>
        <input id="full_name" name="full_name" type="text" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Email *</label>
        <input id="email" name="email" type="email" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="university" className={labelClass}>University / Campus *</label>
        <input id="university" name="university" type="text" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="country" className={labelClass}>Country *</label>
        <input id="country" name="country" type="text" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="track_interest" className={labelClass}>Track of Interest</label>
        <select id="track_interest" name="track_interest" defaultValue="" className={`mt-2 ${fieldClass}`}>
          <option value="">Select one…</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="application_type" className={labelClass}>Application Type</label>
        <select
          id="application_type"
          name="application_type"
          value={appType}
          onChange={(e) => setAppType(e.target.value as AppType)}
          className={`mt-2 ${fieldClass}`}
        >
          <option value="member">Member</option>
          <option value="chapter">Start a Chapter</option>
          <option value="mentor">Become a Mentor</option>
        </select>
      </div>
      <div>
        <label htmlFor="referral_source" className={labelClass}>How did you hear about us?</label>
        <select id="referral_source" name="referral_source" defaultValue="" className={`mt-2 ${fieldClass}`}>
          <option value="">Select one…</option>
          <option value="X (Twitter)">X / Twitter</option>
          <option value="Instagram">Instagram</option>
          <option value="Friend">Friend</option>
          <option value="BigMarkt">BigMarkt</option>
          <option value="FTS Academy">FTS Academy</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="why_join" className={labelClass}>Why do you want to join? *</label>
        <textarea id="why_join" name="why_join" required maxLength={800} rows={5} className={`mt-2 ${fieldClass}`} />
        <p className="mt-1 text-xs text-white/40">Max 800 characters.</p>
      </div>

      <Turnstile />

      {state.error && (
        <p className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#C9A84C] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#d8b955] disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit Application"}
      </button>

      <p className="text-center text-xs text-white/40">
        By submitting, you agree to our{" "}
        <Link href="/privacy" className="text-white/60 hover:text-white underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
