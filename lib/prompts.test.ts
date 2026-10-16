import { describe, expect, it } from "vitest";
import { NO_PRODUCT_PREFIX, buildSystemPrompt, buildUserText } from "./prompts";
import { STYLES } from "./schema";

describe("system prompt", () => {
  it.each(STYLES)("requires %s voice in caption, description and status", (style) => {
    const p = buildSystemPrompt(style);
    expect(p).toMatch(/"caption", "description" and "whatsapp_status" must ALL be written/);
  });

  it("gives Pidgin and Yoruba distinct voices with worked examples", () => {
    const pidgin = buildSystemPrompt("pidgin");
    const yoruba = buildSystemPrompt("yoruba");
    expect(pidgin).toContain("Naija Pidgin");
    expect(pidgin).toMatch(/dey/);
    expect(yoruba).toContain("E káàbọ̀");
    expect(yoruba).toMatch(/never broken English and never Pidgin/);
    expect(pidgin).not.toEqual(yoruba);
  });

  it("bans American slang for every style", () => {
    for (const style of STYLES) {
      expect(buildSystemPrompt(style)).toMatch(/Never use American slang such as "no cap", "slay", "bestie"/);
    }
  });

  it("forbids unsupported facts and handles unsellable photos", () => {
    const p = buildSystemPrompt("english");
    expect(p).toMatch(/Never state a fact the photos or the seller's hints do not support/);
    for (const kind of ["material or fabric", "size", "ingredients", "brand or model", "origin"]) {
      expect(p).toContain(kind);
    }
    expect(p).toMatch(/"NAFDAC approved"/);
    expect(p).toMatch(/"UK used"/);
    expect(p).toMatch(/any health or safety claim/);
    expect(p).toMatch(/If a hint gives one of these facts, use it exactly as given/);
    expect(p).toContain(`"${NO_PRODUCT_PREFIX}: "`);
    expect(p).toMatch(/EVERY distinct part/);
  });

  it("allows one generic use suggestion", () => {
    expect(buildSystemPrompt("english")).toMatch(/You MAY add ONE short, generic suggestion/);
  });

  it.each(STYLES)("gives %s a right and a wrong example on a product other than the jam jar", (style) => {
    const p = buildSystemPrompt(style);
    expect(p).toMatch(/right caption: "/);
    expect(p).toMatch(/wrong caption: ".+" \(.+not in the photo\)/);
    expect(p).not.toMatch(/\bjam\b/i);
  });

  it("asks for 5 to 8 hashtags and a non-repeating price note", () => {
    const p = buildSystemPrompt("english");
    expect(p).toContain("5 to 8 hashtags");
    expect(p).toMatch(/do not use the words "rough", "estimate", "guide" or "guarantee"/);
  });
});

describe("user text", () => {
  it("restates the style so the voice is the last thing the model reads", () => {
    expect(buildUserText({}, 1, "pidgin")).toContain("in Naija Pidgin");
    expect(buildUserText({}, 2, "yoruba")).toContain("Yoruba-flavoured English");
  });

  it("includes only the hints that are present", () => {
    const t = buildUserText({ name: "Tote", price: "15000" }, 1, "english");
    expect(t).toContain("Product name: Tote");
    expect(t).toContain("Seller's price in mind: 15000");
    expect(t).not.toContain("Condition");
  });
});
