import type { EaDealPayload } from "@/lib/ea/normalize";

// A complete, schema-valid EaDealPayload (the *output* type, where every
// .default() field is present). Tests pass partial overrides for the bits they
// care about; the rest get sensible neutral values matching the zod defaults.
export function makeDealPayload(overrides: Partial<EaDealPayload> = {}): EaDealPayload {
  return {
    ticket: 1234567,
    symbol: "EURUSD",
    type: "buy",
    lots: 0.1,
    open_price: 1.0876,
    close_price: 0,
    open_time: "2026-05-17T12:00:00Z",
    close_time: null,
    profit: 0,
    swap: 0,
    commission: 0,
    magic: 0,
    comment: "",
    sl: 0,
    tp: 0,
    r_multiple: 0,
    ...overrides,
  };
}
