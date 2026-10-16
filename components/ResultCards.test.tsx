import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/schema";
import { ResultCards, isNoProduct } from "./ResultCards";

const listing: Listing = {
  title: "Ankara Tote Bag",
  caption: "Red tote with brown handles. DM to order.",
  description: "A red tote with brown handles.",
  hashtags: ["#tote"],
  whatsapp_status: "New tote. DM to order.",
  price_range_ngn: { low: 12000, high: 18000, note: "Depends on fabric and size." },
};

const noop = () => {};

describe("ResultCards", () => {
  it("shows one heading hierarchy: h2 for the listing, h3 per card", () => {
    const html = renderToStaticMarkup(
      <ResultCards listing={listing} ms={31000} headingRef={null} onRegenerate={noop} onCopied={noop} />,
    );
    expect(html).toContain("Your listing</h2>");
    expect((html.match(/<h3/g) ?? []).length).toBe(5);
    expect(html).not.toMatch(/<h1/);
  });

  it("keeps the disclaimer in the UI and the model note separate", () => {
    const html = renderToStaticMarkup(
      <ResultCards listing={listing} ms={1} headingRef={null} onRegenerate={noop} onCopied={noop} />,
    );
    expect(html).toContain("Depends on fabric and size.");
    expect(html.match(/rough guide only, not a guarantee/gi)).toHaveLength(1);
  });

  it("asks the seller to check the listing, as plain text rather than an announcement", () => {
    const html = renderToStaticMarkup(
      <ResultCards listing={listing} ms={1} headingRef={null} onRegenerate={noop} onCopied={noop} />,
    );
    expect(html).toMatch(
      /<p class="[^"]*">Read it through and fix anything that isn’t true for your product before you post\.<\/p>/,
    );
    expect(html).not.toMatch(/aria-live|role="(status|alert)"/);
  });

  it("shows a clear message instead of cards when no product is visible", () => {
    const empty: Listing = {
      ...listing,
      title: "No sellable product visible: the photo shows only a wall",
      hashtags: [],
    };
    expect(isNoProduct(empty)).toBe(true);
    const html = renderToStaticMarkup(
      <ResultCards listing={empty} ms={1} headingRef={null} onRegenerate={noop} onCopied={noop} />,
    );
    expect(html).toContain("We couldn’t see a product to list");
    expect(html).toContain("the photo shows only a wall");
    expect(html).not.toContain("Instagram caption");
  });
});
