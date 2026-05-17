import { describe, expect, it } from "vitest";
import {
  buildActivationSummary,
  type BuildActivationInput,
} from "@/lib/activation";

// Baseline: complete profile + chosen journal mode. Subtests override
// the path-specific fields (tradeCount, brokerAccountCount, etc.).
function baseManual(
  overrides: Partial<BuildActivationInput> = {},
): BuildActivationInput {
  return {
    displayName: "Trader One",
    username: "trader1",
    journalMode: "manual",
    visibility: "private",
    tradeCount: 0,
    brokerAccountCount: 0,
    eaTokenCount: 0,
    ...overrides,
  };
}

function baseAutomated(
  overrides: Partial<BuildActivationInput> = {},
): BuildActivationInput {
  return {
    displayName: "Trader Two",
    username: "trader2",
    journalMode: "automated",
    visibility: "private",
    tradeCount: 0,
    brokerAccountCount: 0,
    eaTokenCount: 0,
    ...overrides,
  };
}

describe("buildActivationSummary — path selection", () => {
  it("manual journalMode → manual path", () => {
    const s = buildActivationSummary(baseManual());
    expect(s.path).toBe("manual");
  });

  it("automated journalMode → automated path", () => {
    const s = buildActivationSummary(baseAutomated());
    expect(s.path).toBe("automated");
  });

  it("hybrid is treated as automated for path selection", () => {
    const s = buildActivationSummary(
      baseAutomated({ journalMode: "hybrid" }),
    );
    expect(s.path).toBe("automated");
  });

  it("null journalMode defaults to manual path", () => {
    const s = buildActivationSummary(baseManual({ journalMode: null }));
    expect(s.path).toBe("manual");
  });
});

describe("buildActivationSummary — manual path next step", () => {
  it("manual user with no trades → next step is first_trade", () => {
    const s = buildActivationSummary(baseManual());
    expect(s.nextStep?.key).toBe("first_trade");
  });

  it("manual user with at least one trade → first_trade and first_insight both complete", () => {
    const s = buildActivationSummary(baseManual({ tradeCount: 1 }));
    const firstTrade = s.steps.find((x) => x.key === "first_trade");
    const firstInsight = s.steps.find((x) => x.key === "first_insight");
    expect(firstTrade?.complete).toBe(true);
    expect(firstInsight?.complete).toBe(true);
  });
});

describe("buildActivationSummary — automated path next step", () => {
  it("automated user with no broker account → next step is connect_account", () => {
    const s = buildActivationSummary(baseAutomated());
    expect(s.nextStep?.key).toBe("connect_account");
  });

  it("automated user with broker account, no EA token → next step is ea_setup", () => {
    const s = buildActivationSummary(
      baseAutomated({ brokerAccountCount: 1 }),
    );
    expect(s.nextStep?.key).toBe("ea_setup");
  });

  it("automated user with broker account + EA token, no trades → next step is first_trade", () => {
    const s = buildActivationSummary(
      baseAutomated({ brokerAccountCount: 1, eaTokenCount: 1 }),
    );
    expect(s.nextStep?.key).toBe("first_trade");
  });

  it("ea_setup completion is driven by eaTokenCount, not brokerAccountCount", () => {
    // A user with a broker account but zero active EA tokens must NOT
    // have ea_setup marked complete — that's the codex tweak 1 rule.
    const s = buildActivationSummary(
      baseAutomated({ brokerAccountCount: 1, eaTokenCount: 0 }),
    );
    const eaSetup = s.steps.find((x) => x.key === "ea_setup");
    expect(eaSetup?.complete).toBe(false);
  });
});

describe("buildActivationSummary — public_profile (optional)", () => {
  it("public visibility completes public_profile", () => {
    const s = buildActivationSummary(baseManual({ visibility: "public" }));
    const pp = s.steps.find((x) => x.key === "public_profile");
    expect(pp?.complete).toBe(true);
  });

  it("community visibility completes public_profile", () => {
    const s = buildActivationSummary(baseManual({ visibility: "community" }));
    const pp = s.steps.find((x) => x.key === "public_profile");
    expect(pp?.complete).toBe(true);
  });

  it("private visibility does NOT complete public_profile", () => {
    const s = buildActivationSummary(baseManual({ visibility: "private" }));
    const pp = s.steps.find((x) => x.key === "public_profile");
    expect(pp?.complete).toBe(false);
  });

  it("public_profile step is flagged optional", () => {
    const s = buildActivationSummary(baseManual());
    const pp = s.steps.find((x) => x.key === "public_profile");
    expect(pp?.optional).toBe(true);
  });
});

describe("buildActivationSummary — required-only percent math (codex tweak 3)", () => {
  it("all required complete + optional incomplete → percent 100 and nextStep null", () => {
    // Manual path: profile + journal_mode + first_trade + first_insight
    // are all required. public_profile is optional.
    const s = buildActivationSummary(
      baseManual({ tradeCount: 1, visibility: "private" }),
    );
    expect(s.percent).toBe(100);
    expect(s.nextStep).toBeNull();
  });

  it("all required complete + optional also complete → percent stays 100", () => {
    const s = buildActivationSummary(
      baseManual({ tradeCount: 1, visibility: "public" }),
    );
    expect(s.percent).toBe(100);
    expect(s.nextStep).toBeNull();
  });

  it("percent never exceeds 100", () => {
    const s = buildActivationSummary(
      baseAutomated({
        brokerAccountCount: 5,
        eaTokenCount: 5,
        tradeCount: 100,
        visibility: "public",
      }),
    );
    expect(s.percent).toBeLessThanOrEqual(100);
    expect(s.percent).toBeGreaterThanOrEqual(0);
  });

  it("percent never goes below 0", () => {
    const s = buildActivationSummary({
      displayName: null,
      username: null,
      journalMode: null,
      visibility: null,
      tradeCount: 0,
      brokerAccountCount: 0,
    });
    expect(s.percent).toBeGreaterThanOrEqual(0);
    expect(s.percent).toBeLessThanOrEqual(100);
  });

  it("manual totalCount is 4 (excludes optional public_profile)", () => {
    const s = buildActivationSummary(baseManual());
    expect(s.totalCount).toBe(4);
  });

  it("automated totalCount is 5 (excludes optional public_profile)", () => {
    const s = buildActivationSummary(baseAutomated());
    expect(s.totalCount).toBe(5);
  });

  it("optional incomplete does not affect nextStep when required complete", () => {
    // Required all done, optional not done. nextStep MUST be null —
    // optional steps never block completion.
    const s = buildActivationSummary(
      baseAutomated({
        brokerAccountCount: 1,
        eaTokenCount: 1,
        tradeCount: 1,
        visibility: "private",
      }),
    );
    expect(s.nextStep).toBeNull();
  });
});

describe("buildActivationSummary — profile completion", () => {
  it("missing displayName → profile incomplete", () => {
    const s = buildActivationSummary(baseManual({ displayName: null }));
    const profile = s.steps.find((x) => x.key === "profile");
    expect(profile?.complete).toBe(false);
    expect(s.nextStep?.key).toBe("profile");
  });

  it("missing username → profile incomplete", () => {
    const s = buildActivationSummary(baseManual({ username: null }));
    const profile = s.steps.find((x) => x.key === "profile");
    expect(profile?.complete).toBe(false);
  });

  it("whitespace-only displayName does not count", () => {
    const s = buildActivationSummary(baseManual({ displayName: "   " }));
    const profile = s.steps.find((x) => x.key === "profile");
    expect(profile?.complete).toBe(false);
  });
});

describe("buildActivationSummary — step ordering and href targets", () => {
  it("manual path orders steps: profile → journal_mode → first_trade → first_insight → public_profile", () => {
    const s = buildActivationSummary(baseManual());
    expect(s.steps.map((x) => x.key)).toEqual([
      "profile",
      "journal_mode",
      "first_trade",
      "first_insight",
      "public_profile",
    ]);
  });

  it("automated path orders steps: profile → journal_mode → connect_account → ea_setup → first_trade → public_profile", () => {
    const s = buildActivationSummary(baseAutomated());
    expect(s.steps.map((x) => x.key)).toEqual([
      "profile",
      "journal_mode",
      "connect_account",
      "ea_setup",
      "first_trade",
      "public_profile",
    ]);
  });

  it("connect_account points to /accounts (broker accounts page)", () => {
    const s = buildActivationSummary(baseAutomated());
    const step = s.steps.find((x) => x.key === "connect_account");
    expect(step?.href).toBe("/accounts");
  });

  it("ea_setup points to /ea-setup", () => {
    const s = buildActivationSummary(baseAutomated());
    const step = s.steps.find((x) => x.key === "ea_setup");
    expect(step?.href).toBe("/ea-setup");
  });
});
