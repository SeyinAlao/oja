import { describe, expect, it, vi } from "vitest";
import { AiError, type ChatFn } from "./ai-client";
import { extractJsonObject, stripCodeFences } from "./extract-json";
import { generateListing, parseListing } from "./generate";
import { createRateLimiter } from "./rate-limit";
import type { GenerateRequest } from "./schema";

const valid = {
  title: "Ankara Tote Bag",
  caption: "Carry Lagos in style. DM to order.",
  description: "A sturdy Ankara tote. Delivery in Lagos, Abuja and Port Harcourt.",
  hashtags: ["ankara", "#lagosfashion"],
  whatsapp_status: "New Ankara tote. DM to order.",
  price_range_ngn: { low: 8000, high: 12000, note: "Rough guide only." },
};

const request: GenerateRequest = {
  images: ["data:image/jpeg;base64,AAAA"],
  hints: {},
  style: "english",
};

describe("stripCodeFences", () => {
  it("removes json fences", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("removes an unclosed opening fence", () => {
    expect(stripCodeFences('```json\n{"a":1}')).toBe('{"a":1}');
  });
});

describe("extractJsonObject", () => {
  it("parses a fenced object surrounded by chatter", () => {
    const raw = 'Sure! Here you go:\n```json\n{"a": 1}\n```\nHope that helps.';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });
  it("handles braces inside strings", () => {
    expect(extractJsonObject('{"a": "x } y { z"}')).toEqual({ a: "x } y { z" });
  });
  it("handles escaped quotes", () => {
    expect(extractJsonObject('{"a": "say \\"hi\\" }"}')).toEqual({ a: 'say "hi" }' });
  });
  it("ignores trailing text after the object", () => {
    expect(extractJsonObject('{"a":{"b":2}} trailing {junk')).toEqual({ a: { b: 2 } });
  });
  it("throws when there is no object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(/No JSON/);
  });
  it("throws on a truncated object", () => {
    expect(() => extractJsonObject('{"a": "b"')).toThrow(/not complete/);
  });
});

describe("parseListing", () => {
  it("accepts a valid listing and normalises hashtags", () => {
    const r = parseListing(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.listing.hashtags).toEqual(["#ankara", "#lagosfashion"]);
  });
  it("coerces comma-formatted price strings", () => {
    const raw = JSON.stringify({ ...valid, price_range_ngn: { low: "₦8,000", high: "12,000", note: "n" } });
    const r = parseListing(raw);
    expect(r.ok && r.listing.price_range_ngn).toMatchObject({ low: 8000, high: 12000 });
  });
  it("swaps a reversed price range", () => {
    const raw = JSON.stringify({ ...valid, price_range_ngn: { low: 20000, high: 5000, note: "n" } });
    const r = parseListing(raw);
    expect(r.ok && r.listing.price_range_ngn).toMatchObject({ low: 5000, high: 20000 });
  });
  it("reports which field is wrong", () => {
    const { title: _title, ...rest } = valid;
    void _title;
    const r = parseListing(JSON.stringify(rest));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem).toContain("title");
  });
  it("fails on non-JSON", () => {
    expect(parseListing("sorry I cannot").ok).toBe(false);
  });
});

describe("generateListing repair flow", () => {
  it("returns on the first valid reply without a second call", async () => {
    const send = vi.fn<ChatFn>().mockResolvedValue("```json\n" + JSON.stringify(valid) + "\n```");
    const listing = await generateListing(request, send);
    expect(listing.title).toBe("Ankara Tote Bag");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries once with a repair prompt that names the problem", async () => {
    const send = vi
      .fn<ChatFn>()
      .mockResolvedValueOnce('{"title": "Only a title"}')
      .mockResolvedValueOnce(JSON.stringify(valid));
    const listing = await generateListing(request, send);
    expect(listing.caption).toBe(valid.caption);
    expect(send).toHaveBeenCalledTimes(2);
    const repairMessages = send.mock.calls[1]![0];
    const last = repairMessages[repairMessages.length - 1]!;
    expect(last.role).toBe("user");
    expect(String(last.content)).toContain("caption");
  });

  it("gives up with bad_output after one repair attempt", async () => {
    const send = vi.fn<ChatFn>().mockResolvedValue("not json at all");
    await expect(generateListing(request, send)).rejects.toMatchObject({
      name: "AiError",
      code: "bad_output",
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not retry transport errors", async () => {
    const send = vi.fn<ChatFn>().mockRejectedValue(new AiError("unreachable", "down"));
    await expect(generateListing(request, send)).rejects.toMatchObject({ code: "unreachable" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends images in OpenAI vision format", async () => {
    const send = vi.fn<ChatFn>().mockResolvedValue(JSON.stringify(valid));
    await generateListing(request, send);
    const user = send.mock.calls[0]![0][1]!;
    expect(user.content).toContainEqual({
      type: "image_url",
      image_url: { url: request.images[0] },
    });
  });
});

describe("createRateLimiter", () => {
  it("blocks after the limit and resets after the window", () => {
    let t = 0;
    const check = createRateLimiter(2, 1000, () => t);
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
    expect(check("b").allowed).toBe(true);
    t = 1001;
    expect(check("a").allowed).toBe(true);
  });
});
