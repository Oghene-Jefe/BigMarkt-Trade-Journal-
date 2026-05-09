/**
 * Rendering safety. The old static app used innerHTML pervasively with a
 * homegrown escHtml that didn't escape apostrophes — and injected user names
 * into onclick="..." attributes (admin.js:111). React's default text rendering
 * makes that class of bug structurally impossible. This test pins the
 * behaviour so future regressions (raw-HTML escape hatches, html-react-parser,
 * etc.) trip the suite.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("React text rendering", () => {
  it("escapes <script> and event-handler payloads", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const html = renderToStaticMarkup(<span>{evil}</span>);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror=");
  });

  it("escapes quotes that would break out of attributes", () => {
    const name = `O'Brien" onclick="alert(1)`;
    const html = renderToStaticMarkup(<button title={name}>x</button>);
    expect(html).not.toContain(`onclick="alert`);
  });
});
