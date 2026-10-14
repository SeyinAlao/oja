import { z } from "zod";

export const STYLES = ["english", "pidgin", "yoruba"] as const;
export type Style = (typeof STYLES)[number];

const text = (max: number) => z.string().trim().min(1).max(max);

// Small models sometimes return numbers as strings ("25,000"), so coerce.
const naira = z.preprocess((v) => {
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, ""));
  return v;
}, z.number().int().nonnegative());

export const MAX_HASHTAGS = 8;

export const listingSchema = z.object({
  // The model lists what it can see first; this grounds the copy and is not shown to the seller.
  seen: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  title: text(120),
  caption: text(1500),
  description: text(3000),
  // Empty is valid: it is what a "no sellable product" reply carries.
  hashtags: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .transform((tags) => {
      const normal = tags.map((t) => (t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`));
      const unique = [...new Map(normal.map((t) => [t.toLowerCase(), t])).values()];
      return unique.slice(0, MAX_HASHTAGS);
    }),
  whatsapp_status: text(700),
  price_range_ngn: z.object({
    low: naira,
    high: naira,
    note: text(300),
  }),
});

export type Listing = z.infer<typeof listingSchema>;

export const generateRequestSchema = z.object({
  images: z
    .array(z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/))
    .min(1)
    .max(3),
  hints: z
    .object({
      name: z.string().trim().max(80).optional(),
      condition: z.string().trim().max(60).optional(),
      price: z.string().trim().max(40).optional(),
    })
    .default({}),
  style: z.enum(STYLES),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
