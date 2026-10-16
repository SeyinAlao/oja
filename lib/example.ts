import data from "@/content/example.json";
import type { SavedExample } from "./example-schema";

// JSON imports widen literals, so the type is asserted here; example-schema.test.ts parses the
// same file with the real schema. Importing only the type keeps zod out of the client bundle.
export const savedExample = data as SavedExample;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-16" -> "16 October 2026", the same on server and client. */
export function formatSavedDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}
