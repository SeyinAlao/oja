import { z } from "zod";
import { STYLES, listingSchema } from "./schema";

/** Public path of the photo the saved example was generated from. */
export const EXAMPLE_PHOTO = "/examples/jam-jar.jpg";

const savedResultSchema = z.object({
  listing: listingSchema.omit({ seen: true }),
  model: z.string().min(1),
  ms: z.number().int().positive(),
  attempts: z.union([z.literal(1), z.literal(2)]),
  generatedAt: z.iso.date(),
});

/** content/example.json: one real generation per style for the same photo. */
export const savedExampleSchema = z.object({
  photo: z.literal(EXAMPLE_PHOTO),
  results: z.record(z.enum(STYLES), savedResultSchema),
});

export type SavedResult = z.infer<typeof savedResultSchema>;
export type SavedExample = z.infer<typeof savedExampleSchema>;
