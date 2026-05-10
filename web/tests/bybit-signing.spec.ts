/**
 * Pin Bybit V5 request signing.
 *
 * The expected hex below is HMAC-SHA256(secret, payload) computed by openssl:
 *
 *   echo -n "1700000000000testapikey5000category=linear" \
 *     | openssl dgst -sha256 -hmac "testsecret"
 *
 * If signing.ts ever changes its payload composition (order, separators,
 * algorithm), this fixture catches it.
 */
import { describe, it, expect } from "vitest";
import {
  buildBybitQueryString,
  bybitBaseUrl,
  signBybitRequest,
} from "@/lib/exchanges/bybit/signing";

const KNOWN_SIGNATURE =
  "97fc9034a1de75f9e7c50f37ff3090caebf4732dbb65cb33d6e9987d79bdd2ba";

describe("buildBybitQueryString", () => {
  it("preserves insertion order", () => {
    expect(buildBybitQueryString({ category: "linear", limit: 100 })).toBe(
      "category=linear&limit=100",
    );
  });

  it("drops undefined / null / empty-string values", () => {
    expect(
      buildBybitQueryString({ a: 1, b: undefined, c: null, d: "", e: "x" }),
    ).toBe("a=1&e=x");
  });

  it("returns empty string when no params", () => {
    expect(buildBybitQueryString({})).toBe("");
    expect(buildBybitQueryString()).toBe("");
  });
});

describe("bybitBaseUrl", () => {
  it("maps mainnet/testnet correctly", () => {
    expect(bybitBaseUrl("mainnet")).toBe("https://api.bybit.com");
    expect(bybitBaseUrl("testnet")).toBe("https://api-testnet.bybit.com");
  });
});

describe("signBybitRequest", () => {
  const inputs = {
    apiKey: "testapikey",
    apiSecret: "testsecret",
    baseUrl: "https://api.bybit.com",
    path: "/v5/position/closed-pnl",
    query: { category: "linear" as const },
    recvWindow: 5000,
    timestamp: 1700000000000,
  };

  it("computes HMAC-SHA256 over (timestamp + apiKey + recvWindow + queryString)", () => {
    const signed = signBybitRequest(inputs);
    expect(signed.headers["X-BAPI-SIGN"]).toBe(KNOWN_SIGNATURE);
  });

  it("includes all four required headers", () => {
    const signed = signBybitRequest(inputs);
    expect(signed.headers).toMatchObject({
      "X-BAPI-API-KEY": "testapikey",
      "X-BAPI-TIMESTAMP": "1700000000000",
      "X-BAPI-RECV-WINDOW": "5000",
      "X-BAPI-SIGN": expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("appends query string to URL", () => {
    const signed = signBybitRequest(inputs);
    expect(signed.url).toBe(
      "https://api.bybit.com/v5/position/closed-pnl?category=linear",
    );
  });

  it("omits query string from URL when no params", () => {
    const signed = signBybitRequest({
      ...inputs,
      path: "/v5/user/query-api",
      query: undefined,
    });
    expect(signed.url).toBe("https://api.bybit.com/v5/user/query-api");
  });

  it("changes signature when timestamp changes", () => {
    const a = signBybitRequest(inputs).headers["X-BAPI-SIGN"];
    const b = signBybitRequest({ ...inputs, timestamp: 1700000001000 }).headers[
      "X-BAPI-SIGN"
    ];
    expect(a).not.toBe(b);
  });

  it("changes signature when secret changes", () => {
    const a = signBybitRequest(inputs).headers["X-BAPI-SIGN"];
    const b = signBybitRequest({ ...inputs, apiSecret: "different" }).headers[
      "X-BAPI-SIGN"
    ];
    expect(a).not.toBe(b);
  });

  it("changes signature when query changes", () => {
    const a = signBybitRequest(inputs).headers["X-BAPI-SIGN"];
    const b = signBybitRequest({ ...inputs, query: { category: "linear", limit: 50 } })
      .headers["X-BAPI-SIGN"];
    expect(a).not.toBe(b);
  });

  it("rejects empty apiKey or apiSecret", () => {
    expect(() => signBybitRequest({ ...inputs, apiKey: "" })).toThrow();
    expect(() => signBybitRequest({ ...inputs, apiSecret: "" })).toThrow();
  });

  it("uses 5000ms recvWindow by default", () => {
    const signed = signBybitRequest({ ...inputs, recvWindow: undefined });
    expect(signed.headers["X-BAPI-RECV-WINDOW"]).toBe("5000");
  });
});
