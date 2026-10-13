import type { GenerateRequest, Style } from "./schema";

const BASE = `You write product listings for small Nigerian sellers who sell on Instagram and WhatsApp.
Look closely at the photos and describe only what you can actually see. Never invent brands, sizes, materials or specs that are not visible or given in the seller's hints.
Write the way a good Nigerian seller talks to customers: warm, direct, confident. Prices use the Naira sign, like ₦25,000. Use "DM to order". Mention delivery in Lagos, Abuja and Port Harcourt (and nationwide) when it fits.
No more than a few emojis per field. No empty hype, no lies about quality.
Reply with ONE JSON object and nothing else.`;

const VOICES: Record<Style, string> = {
  english: `VOICE: Clear, friendly Nigerian English. Short sentences. Professional but warm, like a trusted boutique. Standard spelling, no slang.`,
  pidgin: `VOICE: Naija Pidgin, the way a sharp market seller actually talks, not a joke. Natural examples: "E dey fine well well", "Wetin you dey wait for?", "No dull yourself", "Abeg DM to order", "We dey deliver for Lagos, Abuja and Port Harcourt". Keep it readable to any Nigerian. Do not overdo it or stack slang on every line. Hashtags and the title can stay in plain English.`,
  yoruba: `VOICE: Warm English with light, respectful Yoruba touches. Use a few well-known phrases naturally, such as "E káàbọ̀" (welcome), "E jọ̀ọ́" (please), "O ṣeun" (thank you) or "ẹ̀wà" (beauty) where they fit. The sentences themselves are proper English, never broken English. Keep Yoruba to one or two phrases per field, with correct spelling and tone marks.`,
};

const SCHEMA = `JSON shape (all fields required):
{
  "title": "short product title, max 70 characters",
  "caption": "Instagram caption, 2-4 short lines, ends with a call to order",
  "description": "longer description, 3-6 sentences: what it is, look and feel, why buy, how to order",
  "hashtags": ["8 to 12 relevant hashtags with #"],
  "whatsapp_status": "1-3 short lines for a WhatsApp status, includes how to order",
  "price_range_ngn": { "low": 0, "high": 0, "note": "one sentence saying this is a rough guide only and why" }
}
price_range_ngn.low and high are plain integers in Naira with no commas. If the seller gave a price in mind, centre the range on it. Otherwise give a realistic guess for the Nigerian market. This is only a rough guide, never a guarantee.`;

export function buildSystemPrompt(style: Style): string {
  return `${BASE}\n\n${VOICES[style]}\n\n${SCHEMA}`;
}

export function buildUserText(hints: GenerateRequest["hints"], imageCount: number): string {
  const lines = [
    `Write the listing for the product in the ${imageCount === 1 ? "photo" : `${imageCount} photos`}.`,
  ];
  if (hints.name) lines.push(`Product name: ${hints.name}`);
  if (hints.condition) lines.push(`Condition: ${hints.condition}`);
  if (hints.price) lines.push(`Seller's price in mind: ${hints.price}`);
  return lines.join("\n");
}

export function buildRepairPrompt(problem: string): string {
  return `Your last reply could not be used: ${problem}\nReply again with ONLY the JSON object in the required shape. No markdown, no code fences, no commentary.`;
}
