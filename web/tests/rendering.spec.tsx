/**
 * Rendering safety. The old static app used innerHTML pervasively with a
 * homegrown escHtml that didn't escape apostrophes — and injected user names
 * into onclick="..." attributes (admin.js:111). React's default text rendering
 * makes that class of bug structurally impossible. This test pins the
 * behaviour so future regressions (raw-HTML escape hatches, html-react-parser,
 * etc.) trip the suite.
 */
import * as React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Vitest's default esbuild JSX transform uses the classic runtime, so
// React must be in scope here. App-level files use the auto runtime
// because Next.js + React 19 inject it via the bundler — but Vitest
// doesn't, and forcing tsconfig.json to "react-jsx" would break Next.
void React;

describe("React text rendering", () => {
  it("escapes <script> and event-handler payloads to text", () => {
    // The angle brackets become entities, so the browser will render the
    // payload as visible text rather than parse it as an element. The
    // literal string "onerror=" is OK to appear inside the text node — it
    // only matters that there's no live <img> element to attach it to.
    const evil = `<img src=x onerror=alert(1)>`;
    const html = renderToStaticMarkup(<span>{evil}</span>);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&gt;");
    expect(html).not.toMatch(/<img\b/);
    expect(html).not.toMatch(/<script/i);
  });

  it("escapes quotes that would break out of attributes", () => {
    const name = `O'Brien" onclick="alert(1)`;
    const html = renderToStaticMarkup(<button title={name}>x</button>);
    expect(html).not.toContain(`onclick="alert`);
  });
});
