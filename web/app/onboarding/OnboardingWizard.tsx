"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PenLine, Bot, Lock, Users, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  checkUsernameAvailableAction,
  saveStep1Action,
  saveStep2Action,
  saveStep3Action,
  skipOnboardingAction,
} from "./actions";
import Logo from "@/components/ui/Logo";

type Mode = "manual" | "automated";
type Visibility = "private" | "community" | "public";

type Props = {
  initialEmailPrefix: string;
  initialDisplayName: string;
  initialUsername: string;
  initialJournalMode: Mode;
  initialVisibility: Visibility;
};

export default function OnboardingWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [username, setUsername] = useState(props.initialUsername);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  // Step 2 state
  const [mode, setMode] = useState<Mode>(props.initialJournalMode);

  // Step 3 state
  const [visibility, setVisibility] = useState<Visibility>(props.initialVisibility);

  async function onUsernameBlur() {
    const v = username.trim();
    if (!v) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }
    setUsernameStatus("checking");
    setUsernameMessage(null);
    const res = await checkUsernameAvailableAction(v);
    if (res.error) {
      setUsernameStatus("invalid");
      setUsernameMessage(res.error);
    } else if (res.available) {
      setUsernameStatus("available");
      setUsernameMessage("Available");
    } else {
      setUsernameStatus("taken");
      setUsernameMessage("Already taken");
    }
  }

  function handleNextFromStep1() {
    setError(null);
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    startTransition(async () => {
      const res = await saveStep1Action(displayName, username);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStep(2);
    });
  }

  function handleNextFromStep2() {
    setError(null);
    startTransition(async () => {
      const res = await saveStep2Action(mode);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStep(3);
    });
  }

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const res = await saveStep3Action(visibility);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/dashboard");
    });
  }

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      await skipOnboardingAction(props.initialEmailPrefix);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo size="md" />
        <span className="text-xs uppercase tracking-wider text-muted">Step {step} of 3</span>
      </header>

      <main className="flex-1">
        {step === 1 ? (
          <section className="space-y-5">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              First, let&apos;s set up your identity.
            </h1>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Display name</span>
                <input
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-panel px-3 py-3 text-base text-white outline-none focus:border-gold"
                  placeholder="How others will see you"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Username</span>
                <input
                  type="text"
                  maxLength={30}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase());
                    setUsernameStatus("idle");
                    setUsernameMessage(null);
                  }}
                  onBlur={onUsernameBlur}
                  className="w-full rounded-md border border-white/15 bg-panel px-3 py-3 text-base text-white outline-none focus:border-gold"
                  placeholder="lowercase, numbers, hyphens"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {usernameMessage ? (
                  <span
                    className={`mt-1 block text-xs ${
                      usernameStatus === "available"
                        ? "text-win"
                        : usernameStatus === "checking"
                          ? "text-muted"
                          : "text-loss"
                    }`}
                  >
                    {usernameStatus === "checking" ? "Checking…" : usernameMessage}
                  </span>
                ) : null}
              </label>
            </div>
            {error ? <p className="text-sm text-loss">{error}</p> : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-5">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              How will you journal your trades?
            </h1>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModeCard
                Icon={PenLine}
                title="Manual"
                body="I will log trades myself after each session"
                selected={mode === "manual"}
                onSelect={() => setMode("manual")}
              />
              <ModeCard
                Icon={Bot}
                title="Automated"
                body="I will connect my broker and capture trades automatically"
                selected={mode === "automated"}
                onSelect={() => setMode("automated")}
              />
            </div>
            {error ? <p className="text-sm text-loss">{error}</p> : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              Who can see your trading profile?
            </h1>
            <div className="flex flex-col gap-3">
              <ModeCard
                Icon={Lock}
                title="Private"
                body="Only you can see your trades and stats"
                selected={visibility === "private"}
                onSelect={() => setVisibility("private")}
                stacked
              />
              <ModeCard
                Icon={Users}
                title="Community"
                body="Logged-in BigMarkt members can see your stats"
                selected={visibility === "community"}
                onSelect={() => setVisibility("community")}
                stacked
              />
              <ModeCard
                Icon={Globe}
                title="Public"
                body="Anyone with your profile link can see your full profile"
                selected={visibility === "public"}
                onSelect={() => setVisibility("public")}
                stacked
              />
            </div>
            {error ? <p className="text-sm text-loss">{error}</p> : null}
          </section>
        ) : null}
      </main>

      <footer className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-between">
        {step === 1 ? (
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="rounded-md border border-white/15 px-4 py-3 text-sm text-muted hover:text-white disabled:opacity-50 sm:w-auto"
          >
            Skip
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
            disabled={pending}
            className="rounded-md border border-white/15 px-4 py-3 text-sm text-muted hover:text-white disabled:opacity-50 sm:w-auto"
          >
            Back
          </button>
        )}

        {step === 1 ? (
          <button
            type="button"
            onClick={handleNextFromStep1}
            disabled={pending || usernameStatus === "taken" || usernameStatus === "invalid"}
            className="rounded-md bg-gold px-4 py-3 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        ) : null}
        {step === 2 ? (
          <button
            type="button"
            onClick={handleNextFromStep2}
            disabled={pending}
            className="rounded-md bg-gold px-4 py-3 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        ) : null}
        {step === 3 ? (
          <button
            type="button"
            onClick={handleFinish}
            disabled={pending}
            className="rounded-md bg-gold px-4 py-3 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Saving…" : "Finish"}
          </button>
        ) : null}
      </footer>
    </div>
  );
}

function ModeCard({
  Icon,
  title,
  body,
  selected,
  onSelect,
  stacked,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  selected: boolean;
  onSelect: () => void;
  stacked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border px-4 py-4 transition ${
        selected
          ? "border-gold bg-gold/10"
          : "border-white/15 bg-panel hover:border-white/30"
      } ${stacked ? "" : "min-h-[140px]"}`}
    >
      <div className="flex items-start gap-3">
        <Icon
          size={20}
          aria-hidden
          className={selected ? "text-gold" : "text-muted"}
        />
        <div className="min-w-0">
          <p className={`font-medium ${selected ? "text-gold" : "text-white"}`}>{title}</p>
          <p className="mt-1 text-xs text-muted">{body}</p>
        </div>
      </div>
    </button>
  );
}

