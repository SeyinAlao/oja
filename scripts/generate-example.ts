// Generates content/example.json: the jam jar photo sent through the configured model service
// once per style, validated with the app's own schema. One-off; not part of the runtime.
// Usage: pnpm example [english] [pidgin] [yoruba]   (reads AI_* from .env.local)
// Naming styles regenerates only those and keeps the others from the existing file.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { EXAMPLE_PHOTO, savedExampleSchema, type SavedResult } from "../lib/example-schema";
import { generateWithFallback } from "../lib/model-service";
import { STYLES, type Listing, type Style } from "../lib/schema";

const MAX_TRIES = 3;
const OUTPUT = "content/example.json";

const VOICE_MARKERS: Partial<Record<Style, RegExp>> = {
  pidgin: /\b(dey|na|wey|abeg|oya|una|no be|sharp sharp|well well|don land)\b/i,
  yoruba: /(káàbọ̀|jọ̀ọ́|ṣeun|ẹ̀wà|ó dára)/i,
};
const SLANG = /\b(no cap|slay|bestie|vibes?|lit|fire)\b/i;

/** The fields that must carry the chosen voice that do not, plus any slang found. */
function styleProblems(listing: Omit<Listing, "seen">, style: Style): string[] {
  const fields = {
    caption: listing.caption,
    description: listing.description,
    whatsapp_status: listing.whatsapp_status,
  };
  const marker = VOICE_MARKERS[style];
  return Object.entries(fields).flatMap(([name, text]) => [
    ...(marker && !marker.test(text) ? [`${name} is not in the ${style} voice`] : []),
    ...(SLANG.test(text) ? [`${name} uses slang`] : []),
  ]);
}

async function generateStyle(image: string, style: Style): Promise<SavedResult> {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const started = performance.now();
    try {
      const served = await generateWithFallback({ images: [image], hints: {}, style });
      const { seen: _seen, ...listing } = served.listing;
      void _seen;
      const problems = styleProblems(listing, style);
      if (problems.length === 0) {
        return {
          listing,
          model: served.model,
          ms: Math.round(performance.now() - started),
          attempts: served.attempts,
          generatedAt: new Date().toISOString().slice(0, 10),
        };
      }
      console.warn(`${style}: try ${attempt} rejected: ${problems.join("; ")}`);
    } catch (err) {
      console.warn(`${style}: try ${attempt} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  throw new Error(`${style}: no acceptable result after ${MAX_TRIES} tries`);
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const photo = await readFile(`public${EXAMPLE_PHOTO}`);
  const image = `data:image/jpeg;base64,${photo.toString("base64")}`;

  const requested = STYLES.filter((s) => process.argv.slice(2).includes(s));
  const styles = requested.length > 0 ? requested : STYLES;
  const results: Partial<Record<Style, SavedResult>> =
    requested.length > 0
      ? savedExampleSchema.parse(JSON.parse(await readFile(OUTPUT, "utf8"))).results
      : {};
  for (const style of styles) {
    const result = await generateStyle(image, style);
    results[style] = result;
    console.log(`${style}: ok, ${result.model}, ${result.ms} ms`);
  }

  const example = savedExampleSchema.parse({ photo: EXAMPLE_PHOTO, results });
  await writeFile(OUTPUT, `${JSON.stringify(example, null, 2)}\n`);
  console.log(`wrote ${OUTPUT}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
