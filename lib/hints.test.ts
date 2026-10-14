import { describe, expect, it } from "vitest";
import { buildHints } from "./hints";

describe("buildHints", () => {
  it("sends nothing when the fields are empty, so placeholders can never leak", () => {
    expect(buildHints({ name: "", condition: "", price: "" })).toEqual({});
  });

  it("drops whitespace-only values", () => {
    expect(buildHints({ name: "   ", condition: "\t", price: " " })).toEqual({});
  });

  it("sends only what was typed, trimmed", () => {
    expect(buildHints({ name: " Ankara tote ", condition: "", price: " 15000 " })).toEqual({
      name: "Ankara tote",
      price: "15000",
    });
  });

  it("is never the placeholder text for an untouched form", () => {
    const hints = JSON.stringify(buildHints({ name: "", condition: "", price: "" }));
    expect(hints).not.toMatch(/15000|15,000|Ankara|Brand new/);
  });
});
