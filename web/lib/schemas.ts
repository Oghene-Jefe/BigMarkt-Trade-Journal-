// Single source of truth for input validation. Used by client forms AND
// server actions — the server never trusts the client's check.
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
  // Honeypot: bots fill hidden fields, humans don't. Must be empty.
  website: z.string().max(0).optional().or(z.literal("")),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: passwordSchema })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const tradeVisibility = z.enum(["private", "public", "exclude"]);
export const profileVisibility = z.enum(["private", "community", "public"]);

export const tradeSchema = z.object({
  pair: z.string().min(1).max(20),
  direction: z.enum(["BUY", "SELL"]),
  result: z.enum(["WIN", "LOSS", "BE"]),
  pnl: z.number().finite(),
  rr_ratio: z.number().finite().nullable().optional(),
  entry: z.number().finite().nullable().optional(),
  exit: z.number().finite().nullable().optional(),
  stop: z.number().finite().nullable().optional(),
  size: z.number().finite().nullable().optional(),
  session: z.string().max(40).nullable().optional(),
  emotions: z.string().max(40).nullable().optional(),
  grade: z.string().max(4).nullable().optional(),
  tags: z.array(z.string().max(30)).max(20).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  visibility: tradeVisibility.default("private"),
  trade_at: z.string().datetime().nullable().optional(),
});
export type TradeInput = z.infer<typeof tradeSchema>;
