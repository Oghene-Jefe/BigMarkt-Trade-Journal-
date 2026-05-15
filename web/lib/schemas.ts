import { z } from "zod";

export const emailSchema = z.string().email().max(254).transform((s) => s.toLowerCase().trim());
export const passwordSchema = z.string().min(6).max(72);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(80).transform((s) => s.trim()),
  website: z.string().optional(),
  // Optional referral code. The profile referral codes are 12-char base64
  // slices of a UUID, so any allowed code matches /^[A-Za-z0-9+/]{1,32}$/.
  // Empty string normalizes to undefined.
  referred_by: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9+/]*$/, "Invalid referral code")
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: passwordSchema })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const tradeVisibility = z.enum(["private", "public", "exclude", "followers_only"]);
export const profileVisibility = z.enum(["private", "community", "public"]);
export const journalMode = z.enum(["manual", "automated"]);

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
  .transform((s) => s.toLowerCase().trim());

// Onboarding-only variant: spec calls for lowercase letters / digits / hyphens.
// Kept distinct from usernameSchema so the existing settings page (which uses
// underscores) continues to validate the same way it always has.
export const onboardingUsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .transform((s) => s.toLowerCase().trim())
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers, and hyphens"),
  );

export const onboardingDisplayNameSchema = z
  .string()
  .min(1)
  .max(80)
  .transform((s) => s.trim());

export const balanceResetSchema = z.object({
  new_balance: z.number().finite().positive().max(10_000_000),
  reason: z.string().max(200).nullable().optional(),
});
export type BalanceResetInput = z.infer<typeof balanceResetSchema>;

export const challengeSchema = z.object({
  goal_type: z.string().min(1).max(40).transform((s) => s.trim()),
  goal_target: z.number().finite().positive(),
  start_date: z.string().date(),
  end_date: z.string().date(),
}).refine((v) => v.end_date >= v.start_date, {
  message: "End date must be on or after start date",
  path: ["end_date"],
});
export type ChallengeInput = z.infer<typeof challengeSchema>;

export const challengeStatus = z.enum(["active", "completed", "failed", "abandoned"]);
export const exchangeEnvironment = z.enum(["mainnet", "testnet"]);

export const connectBybitSchema = z.object({
  label: z.string().min(1).max(80).transform((s) => s.trim()),
  environment: exchangeEnvironment,
  apiKey: z.string().min(8).max(128).transform((s) => s.trim()),
  apiSecret: z.string().min(8).max(128).transform((s) => s.trim()),
});
export type ConnectBybitInput = z.infer<typeof connectBybitSchema>;

export const accountType = z.enum(["live", "demo", "prop_firm"]);

export const brokerAccountSchema = z.object({
  label: z.string().min(1).max(50).transform((s) => s.trim()),
  broker_slug: z.string().min(1).max(50).transform((s) => s.trim()),
  account_type: accountType,
  journal_mode: journalMode,
  account_number: z.string().max(60).optional().transform((s) => (s ? s.trim() : "")),
  readonly_password: z.string().max(200).optional().transform((s) => (s ? s.trim() : "")),
});
export type BrokerAccountInput = z.infer<typeof brokerAccountSchema>;

export const tradeSchema = z.object({
  pair: z.string().min(1).max(20),
  direction: z.enum(["BUY", "SELL"]),
  result: z.enum(["WIN", "LOSS", "BE"]),
  pnl: z.number().finite(),
  rr_ratio: z.number().finite().nullable().optional(),
  entry_price: z.number().finite().nullable().optional(),
  exit_price: z.number().finite().nullable().optional(),
  stop_loss: z.number().finite().nullable().optional(),
  take_profit: z.number().finite().nullable().optional(),
  lot_size: z.number().finite().nullable().optional(),
  session: z.string().max(40).nullable().optional(),
  emotions: z.string().max(40).nullable().optional(),
  strategy: z.string().max(80).nullable().optional(),
  setup_grade: z.string().max(4).nullable().optional(),
  tags: z.string().max(400).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  visibility: tradeVisibility.default("private"),
});
export type TradeInput = z.infer<typeof tradeSchema>;
