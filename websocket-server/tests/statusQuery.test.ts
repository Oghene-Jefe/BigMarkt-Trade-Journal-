import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTokenIds } from "../src/statusQuery.js";

describe("parseTokenIds", () => {
  const VALID_A = "11111111-2222-3333-4444-555555555555";
  const VALID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("returns [] for null/undefined/empty", () => {
    assert.deepEqual(parseTokenIds(null), []);
    assert.deepEqual(parseTokenIds(undefined), []);
    assert.deepEqual(parseTokenIds(""), []);
  });

  it("parses a single UUID", () => {
    assert.deepEqual(parseTokenIds(VALID_A), [VALID_A]);
  });

  it("parses a comma-separated list", () => {
    const r = parseTokenIds(`${VALID_A},${VALID_B}`);
    assert.deepEqual(r.sort(), [VALID_A, VALID_B].sort());
  });

  it("lowercases UUIDs (so allow-list compares are case-insensitive)", () => {
    const upper = VALID_A.toUpperCase();
    assert.deepEqual(parseTokenIds(upper), [VALID_A]);
  });

  it("deduplicates repeated IDs", () => {
    assert.deepEqual(
      parseTokenIds(`${VALID_A},${VALID_A},${VALID_A}`),
      [VALID_A],
    );
  });

  it("drops junk entries silently — never throws", () => {
    const mixed = `${VALID_A},not-a-uuid,,undefined,${VALID_B}`;
    const r = parseTokenIds(mixed);
    assert.deepEqual(r.sort(), [VALID_A, VALID_B].sort());
  });

  it("trims whitespace around entries", () => {
    const r = parseTokenIds(`  ${VALID_A}  ,  ${VALID_B}  `);
    assert.deepEqual(r.sort(), [VALID_A, VALID_B].sort());
  });

  it("caps at 200 IDs even if more are sent", () => {
    const many = Array.from({ length: 500 }, (_, i) => {
      // Force-different UUIDs by varying the last byte (hex-safe encoding).
      const hex = i.toString(16).padStart(12, "0");
      return `11111111-2222-3333-4444-${hex}`;
    }).join(",");
    const r = parseTokenIds(many);
    assert.equal(r.length, 200);
  });

  it("rejects non-UUID-shaped strings (no SQL fragments slip through)", () => {
    assert.deepEqual(parseTokenIds("'; drop table ea_tokens; --"), []);
    assert.deepEqual(parseTokenIds("<script>"), []);
    assert.deepEqual(parseTokenIds("../../etc/passwd"), []);
  });
});
