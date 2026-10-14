import type { GenerateRequest } from "./schema";

export type HintFields = { name: string; condition: string; price: string };

/**
 * Only values the seller actually typed are sent. Placeholder text lives in the
 * input's `placeholder` attribute, never in state, so it can never reach here;
 * blank and whitespace-only fields are dropped rather than sent as "".
 */
export function buildHints(fields: HintFields): GenerateRequest["hints"] {
  const hints: GenerateRequest["hints"] = {};
  const name = fields.name.trim();
  const condition = fields.condition.trim();
  const price = fields.price.trim();
  if (name) hints.name = name;
  if (condition) hints.condition = condition;
  if (price) hints.price = price;
  return hints;
}
