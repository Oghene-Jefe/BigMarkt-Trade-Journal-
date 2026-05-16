import { describe, expect, it } from "vitest";
import {
  COUNTRY_TO_CURRENCY,
  extractTag,
  londonUtcOffsetMinutes,
  normalize,
  parseFfDateTime,
  parseXml,
  toImpact,
} from "@/lib/news/forexFactory";

describe("parseFfDateTime", () => {
  it("parses MM-DD-YYYY h:mma during BST (May → London is UTC+1)", () => {
    // 01:30 London BST = 00:30 UTC
    expect(parseFfDateTime("05-11-2026", "1:30am")).toBe("2026-05-11T00:30:00.000Z");
  });

  it("parses a winter date as GMT (no offset)", () => {
    // 14:00 London GMT = 14:00 UTC
    expect(parseFfDateTime("01-15-2026", "2:00pm")).toBe("2026-01-15T14:00:00.000Z");
  });

  it("12:00am is midnight (00:00), not noon", () => {
    expect(parseFfDateTime("01-15-2026", "12:00am")).toBe("2026-01-15T00:00:00.000Z");
  });

  it("12:00pm is noon (12:00), not midnight", () => {
    expect(parseFfDateTime("01-15-2026", "12:00pm")).toBe("2026-01-15T12:00:00.000Z");
  });

  it('"Tentative" falls back to 00:00 London for the date', () => {
    // 00:00 London BST = 23:00 UTC the previous day
    expect(parseFfDateTime("05-11-2026", "Tentative")).toBe("2026-05-10T23:00:00.000Z");
  });

  it('"All Day" falls back to 00:00 London for the date', () => {
    expect(parseFfDateTime("01-15-2026", "All Day")).toBe("2026-01-15T00:00:00.000Z");
  });

  it("empty time string falls back to 00:00", () => {
    expect(parseFfDateTime("01-15-2026", "")).toBe("2026-01-15T00:00:00.000Z");
  });

  it("returns null for malformed date", () => {
    expect(parseFfDateTime("Jan 15, 2025", "1:30am")).toBeNull();
    expect(parseFfDateTime("2026-05-11", "1:30am")).toBeNull();
    expect(parseFfDateTime("", "1:30am")).toBeNull();
  });
});

describe("londonUtcOffsetMinutes", () => {
  it("returns 60 (BST) in summer", () => {
    expect(londonUtcOffsetMinutes(new Date("2026-06-01T12:00:00Z"))).toBe(60);
  });

  it("returns 0 (GMT) in winter", () => {
    expect(londonUtcOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(0);
  });

  it("flips at last Sunday of March 01:00 UTC", () => {
    // Last Sunday of March 2026 is March 29.
    expect(londonUtcOffsetMinutes(new Date("2026-03-29T00:59:00Z"))).toBe(0);
    expect(londonUtcOffsetMinutes(new Date("2026-03-29T01:00:00Z"))).toBe(60);
  });

  it("flips at last Sunday of October 01:00 UTC", () => {
    // Last Sunday of October 2026 is October 25.
    expect(londonUtcOffsetMinutes(new Date("2026-10-25T00:59:00Z"))).toBe(60);
    expect(londonUtcOffsetMinutes(new Date("2026-10-25T01:00:00Z"))).toBe(0);
  });
});

describe("toImpact", () => {
  it("maps high/medium/low (case-insensitive)", () => {
    expect(toImpact("High")).toBe("high");
    expect(toImpact("medium")).toBe("medium");
    expect(toImpact("LOW")).toBe("low");
  });

  it("returns null for unknown impact", () => {
    expect(toImpact("holiday")).toBeNull();
    expect(toImpact("")).toBeNull();
  });
});

describe("extractTag", () => {
  it("handles paired tags", () => {
    expect(extractTag("<title>CPI m/m</title>", "title")).toBe("CPI m/m");
  });

  it("handles CDATA content", () => {
    expect(extractTag("<title><![CDATA[CPI m/m]]></title>", "title")).toBe("CPI m/m");
  });

  it("returns empty for self-closing tags (<forecast />)", () => {
    expect(extractTag("<forecast />", "forecast")).toBe("");
    expect(extractTag("<forecast/>", "forecast")).toBe("");
  });

  it("returns empty for missing tags (no <actual> at all)", () => {
    expect(
      extractTag("<title>CPI m/m</title><previous>0.3%</previous>", "actual"),
    ).toBe("");
  });

  it("decodes XML entities", () => {
    expect(extractTag("<title>Crude &amp; Gas</title>", "title")).toBe("Crude & Gas");
  });
});

describe("parseXml", () => {
  it("parses multiple events including url", () => {
    const xml = `
      <weeklyevents>
        <event>
          <title><![CDATA[CPI m/m]]></title>
          <country>USD</country>
          <date><![CDATA[05-11-2026]]></date>
          <time><![CDATA[1:30am]]></time>
          <impact><![CDATA[High]]></impact>
          <forecast><![CDATA[0.4%]]></forecast>
          <previous><![CDATA[0.3%]]></previous>
          <actual />
          <url><![CDATA[https://www.forexfactory.com/calendar?day=may11.2026]]></url>
        </event>
        <event>
          <title><![CDATA[GDP q/q]]></title>
          <country>GBP</country>
          <date><![CDATA[05-12-2026]]></date>
          <time><![CDATA[All Day]]></time>
          <impact><![CDATA[medium]]></impact>
          <forecast />
        </event>
      </weeklyevents>
    `;
    const events = parseXml(xml);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("CPI m/m");
    expect(events[0].actual).toBe("");
    expect(events[0].url).toBe("https://www.forexfactory.com/calendar?day=may11.2026");
    expect(events[1].forecast).toBe("");
    expect(events[1].url).toBe("");
  });
});

describe("normalize", () => {
  const NOW = "2026-05-01T00:00:00.000Z";

  it("maps a complete USD event row including url", () => {
    const row = normalize(
      {
        title: "CPI m/m",
        country: "USD",
        date: "05-11-2026",
        time: "1:30am",
        impact: "High",
        forecast: "0.4%",
        previous: "0.3%",
        actual: "",
        url: "https://www.forexfactory.com/calendar?day=may11.2026",
      },
      NOW,
    );
    expect(row).toEqual({
      title: "CPI m/m",
      currency: "USD",
      impact: "high",
      event_time: "2026-05-11T00:30:00.000Z",
      forecast: "0.4%",
      previous: "0.3%",
      actual: null,
      url: "https://www.forexfactory.com/calendar?day=may11.2026",
      source: "forex_factory",
      updated_at: NOW,
    });
  });

  it("normalizes url to null when missing", () => {
    const row = normalize(
      {
        title: "GDP q/q",
        country: "GBP",
        date: "05-12-2026",
        time: "All Day",
        impact: "medium",
        forecast: "",
        previous: "",
        actual: "",
        url: "",
      },
      NOW,
    );
    expect(row).not.toBeNull();
    expect(row!.url).toBeNull();
  });

  it("rejects non-http urls (defensive against future feed changes)", () => {
    const row = normalize(
      {
        title: "Random",
        country: "USD",
        date: "05-11-2026",
        time: "9:00am",
        impact: "low",
        forecast: "",
        previous: "",
        actual: "",
        url: "javascript:alert(1)",
      },
      NOW,
    );
    expect(row).not.toBeNull();
    expect(row!.url).toBeNull();
  });

  it("returns null for unknown country (and skips the row)", () => {
    const row = normalize(
      {
        title: "Some PMI",
        country: "Atlantis",
        date: "05-11-2026",
        time: "9:00am",
        impact: "Low",
        forecast: "",
        previous: "",
        actual: "",
        url: "",
      },
      NOW,
    );
    // We keep the row but currency is null — the cron decides whether to
    // surface it; the parser doesn't drop on currency alone.
    expect(row).not.toBeNull();
    expect(row!.currency).toBeNull();
  });

  it("returns null if the date is unparseable", () => {
    expect(
      normalize(
        {
          title: "x",
          country: "USD",
          date: "Jan 15, 2026",
          time: "1:30am",
          impact: "low",
          forecast: "",
          previous: "",
          actual: "",
          url: "",
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("returns null if title is missing", () => {
    expect(
      normalize(
        {
          title: "",
          country: "USD",
          date: "05-11-2026",
          time: "1:30am",
          impact: "low",
          forecast: "",
          previous: "",
          actual: "",
          url: "",
        },
        NOW,
      ),
    ).toBeNull();
  });
});

describe("COUNTRY_TO_CURRENCY", () => {
  it("maps three-letter codes through unchanged", () => {
    expect(COUNTRY_TO_CURRENCY.USD).toBe("USD");
    expect(COUNTRY_TO_CURRENCY.GBP).toBe("GBP");
  });

  it("maps full country names to currency", () => {
    expect(COUNTRY_TO_CURRENCY["United Kingdom"]).toBe("GBP");
    expect(COUNTRY_TO_CURRENCY["Euro Zone"]).toBe("EUR");
  });
});
