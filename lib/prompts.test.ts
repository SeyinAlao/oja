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

  it("forbids invented details and handles unsellable photos", () => {
    const p = buildSystemPrompt("english");
    expect(p).toMatch(/Never invent a brand, a "collection", sizes, materials/);
    expect(p).toContain(`"${NO_PRODUCT_PREFIX}: "`);
    expect(p).toMatch(/EVERY distinct part/);
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
