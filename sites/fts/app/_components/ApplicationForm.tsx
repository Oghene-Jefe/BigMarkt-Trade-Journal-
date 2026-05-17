"use client";

import { useActionState } from "react";
import { submitApplication, type ApplicationState } from "../actions";
import Turnstile from "./Turnstile";

const initial: ApplicationState = { ok: false };

const fieldClass =
  "w-full border border-[#1f1f1f] bg-[#111111] px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#C9A84C] focus:outline-none";
const labelClass = "block text-xs font-semibold uppercase tracking-widest text-white/60";

export default function ApplicationForm() {
  const [state, formAction, pending] = useActionState(submitApplication, initial);

  if (state.ok) {
    return (
      <div className="border border-[#C9A84C] bg-[#111111] p-8">
        <h3 className="text-2xl font-bold text-[#C9A84C]">Application Received ✅</h3>
        <p className="mt-4 text-white/80">
          Welcome to FTS Boot Camp. You are part of the pioneer cohort. We will be in touch with session details.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="https://t.me/ftsbootcamp"
            target="_blank"
            rel="noopener"
            className="bg-[#C9A84C] px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Join the Boot Camp Group on Telegram →
          </a>
          <a
            href="https://journal.bigmarkt.co/signup"
            target="_blank"
            rel="noopener"
            className="border border-[#C9A84C] px-6 py-3 text-center text-sm font-semibold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-black"
          >
            Start Your Free Journal →
          </a>
        </div>
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
        <label htmlFor="email" className={labelClass}>Email Address *</label>
        <input id="email" name="email" type="email" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="country" className={labelClass}>Country *</label>
        <input id="country" name="country" type="text" required className={`mt-2 ${fieldClass}`} />
      </div>
      <div>
        <label htmlFor="experience_level" className={labelClass}>Experience Level *</label>
        <select id="experience_level" name="experience_level" required defaultValue="" className={`mt-2 ${fieldClass}`}>
          <option value="" disabled>Select one…</option>
          <option value="Complete Beginner">Complete Beginner</option>
          <option value="Some Knowledge">Some Knowledge</option>
          <option value="Have Traded Before">Have Traded Before</option>
        </select>
      </div>
      <div>
        <label htmlFor="why_join" className={labelClass}>Why do you want to join Boot Camp? *</label>
        <textarea
          id="why_join"
          name="why_join"
          required
          maxLength={500}
          rows={4}
          className={`mt-2 ${fieldClass}`}
        />
        <p className="mt-1 text-xs text-white/40">Max 500 characters.</p>
      </div>
      <div>
        <label htmlFor="referral_source" className={labelClass}>How did you hear about FTS?</label>
        <select id="referral_source" name="referral_source" defaultValue="" className={`mt-2 ${fieldClass}`}>
          <option value="">Select one…</option>
          <option value="Telegram">Telegram</option>
          <option value="X (Twitter)">X (Twitter)</option>
          <option value="Friend">Friend</option>
          <option value="BigMarkt">BigMarkt</option>
          <option value="Other">Other</option>
        </select>
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
    </form>
  );
}
