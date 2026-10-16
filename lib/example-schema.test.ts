import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import example from "@/content/example.json";
import { STYLES } from "./schema";
import { EXAMPLE_PHOTO, savedExampleSchema } from "./example-schema";

describe("content/example.json", () => {
  it("matches the saved example schema", () => {
    const parsed = savedExampleSchema.safeParse(example);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("has one result per style, each naming its model and date", () => {
    const { results } = savedExampleSchema.parse(example);
    expect(Object.keys(results).sort()).toEqual([...STYLES].sort());
    for (const style of STYLES) {
      expect(results[style].model).not.toBe("");
      expect(results[style].generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("points at a photo that ships with the app", () => {
    expect(existsSync(`public${EXAMPLE_PHOTO}`)).toBe(true);
  });

  it("rejects a file missing a style", () => {
    const { yoruba: _yoruba, ...partial } = example.results;
    void _yoruba;
    expect(savedExampleSchema.safeParse({ ...example, results: partial }).success).toBe(false);
  });
});
