import { describe, expect, it } from "vitest";
import { parseListing } from "./generate";

const base = {
  title: "Tote",
  caption: "c",
  description: "d",
  hashtags: ["#a"],
  whatsapp_status: "w",
  price_range_ngn: { low: 1, high: 2, note: "Fabric and size." },
};

describe("listing schema", () => {
  it("caps hashtags at 8, de-duplicates and adds the #", () => {
    const tags = ["bag", "#Bag", "tote", "ankara", "lagos", "naija", "style", "africanprint", "fashion", "shop"];
    const r = parseListing(JSON.stringify({ ...base, hashtags: tags }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.listing.hashtags).toHaveLength(8);
      expect(new Set(r.listing.hashtags.map((t) => t.toLowerCase())).size).toBe(8);
      expect(r.listing.hashtags.every((t) => t.startsWith("#"))).toBe(true);
    }
  });

  it("accepts an empty hashtag list (the no-product reply)", () => {
    const r = parseListing(
      JSON.stringify({
        ...base,
        title: "No sellable product visible: the photo is a blank wall",
        hashtags: [],
        price_range_ngn: { low: 0, high: 0, note: "No product." },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("accepts and keeps the optional seen list", () => {
    const r = parseListing(JSON.stringify({ ...base, seen: ["red body", "brown handles"] }));
    expect(r.ok && r.listing.seen).toEqual(["red body", "brown handles"]);
  });

  it("rejects an over-long seen list", () => {
    const seen = Array.from({ length: 13 }, (_, i) => `part ${i}`);
    expect(parseListing(JSON.stringify({ ...base, seen })).ok).toBe(false);
  });
});
