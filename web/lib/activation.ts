// Activation flow logic — pure functions over primitive inputs.
//
// This module computes the first-time activation checklist that the
// dashboard renders for new traders. Keep it free of Supabase/Next
// imports so it stays trivially testable and reusable.
//
// Step rules and the required-vs-optional percent math are locked in
// docs/claude-activation-build-proposal.md (Section 11, codex sign-off).

export type ActivationStepKey =
  | "profile"
  | "journal_mode"
  | "first_trade"
  | "connect_account"
  | "ea_setup"
  | "first_insight"
  | "public_profile";

export type ActivationPath = "manual" | "automated";

export type ActivationStep = {
  key: ActivationStepKey;
  title: string;
  body: string;
  href: string;
  complete: boolean;
  optional?: boolean;
};

export type ActivationSummary = {
  path: ActivationPath;
  /** Number of REQUIRED steps that are complete. Optional steps do not count. */
  completeCount: number;
  /** Total number of REQUIRED steps. Optional steps do not count. */
  totalCount: number;
  /** Percentage of required steps complete (0–100, clamped). */
  percent: number;
  /** First incomplete required step, or null when all required are complete. */
  nextStep: ActivationStep | null;
  /** Full ordered list of steps for this path, including optional rows. */
  steps: ActivationStep[];
};

export type BuildActivationInput = {
  displayName: string | null;
  username: string | null;
  journalMode: "manual" | "automated" | "hybrid" | null;
  visibility: "private" | "community" | "public" | string | null;
  tradeCount: number;
  brokerAccountCount: number;
  /** Count of non-revoked EA tokens for the user. Defaults to 0 when omitted. */
  eaTokenCount?: number;
};

function pickPath(
  journalMode: BuildActivationInput["journalMode"],
): ActivationPath {
  // Treat "hybrid" as automated for path selection (codex-approved).
  // Null defaults to manual — a new user without a chosen mode shouldn't
  // be pushed toward broker connection until they pick a mode.
  if (journalMode === "automated" || journalMode === "hybrid") return "automated";
  return "manual";
}

function profileComplete(input: BuildActivationInput): boolean {
  const dn = (input.displayName ?? "").trim();
  const un = (input.username ?? "").trim();
  return dn.length > 0 && un.length > 0;
}

function journalModeComplete(input: BuildActivationInput): boolean {
  return input.journalMode === "manual" || input.journalMode === "automated";
}

function publicProfileComplete(input: BuildActivationInput): boolean {
  return input.visibility === "public" || input.visibility === "community";
}

function buildManualSteps(input: BuildActivationInput): ActivationStep[] {
  const tradeLogged = input.tradeCount > 0;
  return [
    {
      key: "profile",
      title: "Set up your identity",
      body: "Add your display name and username so others can find you.",
      href: "/onboarding",
      complete: profileComplete(input),
    },
    {
      key: "journal_mode",
      title: "Choose how you journal",
      body: "Manual or automated capture — you can change this later.",
      href: "/onboarding",
      complete: journalModeComplete(input),
    },
    {
      key: "first_trade",
      title: "Log your first trade",
      body: "One entry is enough to start seeing metrics move.",
      href: "/journal/new",
      complete: tradeLogged,
    },
    {
      key: "first_insight",
      title: "Unlock your first performance insight",
      body: "We surface win rate, P&L and growth once you have data.",
      href: "/dashboard",
      complete: tradeLogged,
    },
    {
      key: "public_profile",
      title: "Prepare your public proof profile",
      body: "Set visibility to community or public when you're ready to share.",
      href: "/profile",
      complete: publicProfileComplete(input),
      optional: true,
    },
  ];
}

function buildAutomatedSteps(input: BuildActivationInput): ActivationStep[] {
  const eaTokens = input.eaTokenCount ?? 0;
  return [
    {
      key: "profile",
      title: "Set up your identity",
      body: "Add your display name and username so others can find you.",
      href: "/onboarding",
      complete: profileComplete(input),
    },
    {
      key: "journal_mode",
      title: "Choose how you journal",
      body: "Manual or automated capture — you can change this later.",
      href: "/onboarding",
      complete: journalModeComplete(input),
    },
    {
      key: "connect_account",
      title: "Connect your trading account",
      body: "Add the broker account you want auto-captured.",
      href: "/accounts",
      complete: input.brokerAccountCount > 0,
    },
    {
      key: "ea_setup",
      title: "Pair your MT4 / MT5 EA",
      body: "Generate a token and install the EA to start auto-capturing trades.",
      href: "/ea-setup",
      complete: eaTokens > 0,
    },
    {
      key: "first_trade",
      title: "Capture your first trade",
      body: "Once the EA is running, your next executed trade lands automatically.",
      href: "/journal",
      complete: input.tradeCount > 0,
    },
    {
      key: "public_profile",
      title: "Prepare your public proof profile",
      body: "Set visibility to community or public when you're ready to share verified performance.",
      href: "/profile",
      complete: publicProfileComplete(input),
      optional: true,
    },
  ];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Build the activation summary for a given user.
 *
 * Math rules (codex-approved):
 * - completeCount / totalCount / percent reflect REQUIRED steps only.
 * - nextStep is the first non-optional incomplete step; null when all
 *   required steps are complete.
 * - The full `steps` array is returned (including optional) so the UI
 *   can render optional rows separately or with a label.
 */
export function buildActivationSummary(
  input: BuildActivationInput,
): ActivationSummary {
  const path = pickPath(input.journalMode);
  const steps = path === "manual" ? buildManualSteps(input) : buildAutomatedSteps(input);

  const requiredSteps = steps.filter((s) => !s.optional);
  const completeCount = requiredSteps.filter((s) => s.complete).length;
  const totalCount = requiredSteps.length;
  const percent =
    totalCount === 0 ? 100 : clampPercent((completeCount / totalCount) * 100);
  const nextStep = requiredSteps.find((s) => !s.complete) ?? null;

  return {
    path,
    completeCount,
    totalCount,
    percent,
    nextStep,
    steps,
  };
}
