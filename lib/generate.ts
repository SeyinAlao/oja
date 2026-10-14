import { AiError, type ChatFn, type ChatMessage } from "./ai-client";
import { extractJsonObject } from "./extract-json";
import { buildRepairPrompt, buildSystemPrompt, buildUserText } from "./prompts";
import { listingSchema, type GenerateRequest, type Listing } from "./schema";

export type ParseResult = { ok: true; listing: Listing } | { ok: false; problem: string };

/** Raw model text -> validated listing, or a short description of what is wrong. */
export function parseListing(raw: string): ParseResult {
  let json: unknown;
  try {
    json = extractJsonObject(raw);
  } catch (err) {
    return { ok: false, problem: err instanceof Error ? err.message : "invalid JSON" };
  }
  const parsed = listingSchema.safeParse(json);
  if (!parsed.success) {
    const problem = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return { ok: false, problem };
  }
  const { low, high } = parsed.data.price_range_ngn;
  if (low > high) {
    parsed.data.price_range_ngn = { ...parsed.data.price_range_ngn, low: high, high: low };
  }
  return { ok: true, listing: parsed.data };
}

/**
 * Ask the model once; if the reply is unusable, ask once more with a repair prompt.
 * `attempts` is 1 when the first reply was valid, 2 when the repair call was needed.
 */
export async function generateListing(
  req: GenerateRequest,
  send: ChatFn,
): Promise<{ listing: Listing; attempts: 1 | 2 }> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(req.style) },
    {
      role: "user",
      content: [
        { type: "text", text: buildUserText(req.hints, req.images.length, req.style) },
        ...req.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ];

  const first = await send(messages);
  const firstTry = parseListing(first);
  if (firstTry.ok) return { listing: firstTry.listing, attempts: 1 };

  const second = await send([
    ...messages,
    { role: "assistant", content: first },
    { role: "user", content: buildRepairPrompt(firstTry.problem) },
  ]);
  const secondTry = parseListing(second);
  if (secondTry.ok) return { listing: secondTry.listing, attempts: 2 };

  throw new AiError(
    "bad_output",
    `The model's reply was not a valid listing (${secondTry.problem}).`,
  );
}
