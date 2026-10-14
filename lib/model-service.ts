import { AiError, aiConfig, createChat } from "./ai-client";
import { generateListing } from "./generate";
import type { GenerateRequest, Listing } from "./schema";

export type ServedListing = {
  listing: Listing;
  attempts: 1 | 2;
  /** The model that actually produced the listing. */
  model: string;
  fellBack: boolean;
};

/**
 * Primary model first (with its one HTTP retry and one JSON repair call). If it still fails with
 * 429, 5xx or a network error, make one attempt against the fallback model, if configured:
 * no HTTP retry, but its own JSON repair call. Timeouts and other 4xx never fall back. All calls
 * share one deadline, so the whole request stays inside AI_TIMEOUT_SECONDS.
 *
 * Worst case without a fallback: 4 model calls. With one: 6.
 */
export async function generateWithFallback(req: GenerateRequest): Promise<ServedListing> {
  const config = aiConfig();
  const signal = AbortSignal.timeout(config.timeoutMs);
  const shared = { signal, timeoutMs: config.timeoutMs };

  const primary = createChat(
    { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey },
    { ...shared, retry: true },
  );

  try {
    const served = await generateListing(req, primary);
    return { ...served, model: config.model, fellBack: false };
  } catch (err) {
    const { fallback } = config;
    if (!fallback || !(err instanceof AiError) || !err.fallbackEligible) throw err;

    console.warn(
      `[oja] primary model failed (${err.status ? `HTTP ${err.status}` : "network"}), ` +
        `trying fallback: model=${fallback.model}`,
    );
    try {
      const served = await generateListing(req, createChat(fallback, { ...shared, retry: false }));
      return { ...served, model: fallback.model, fellBack: true };
    } catch (fallbackErr) {
      console.warn(
        `[oja] fallback model failed: ${
          fallbackErr instanceof AiError
            ? `${fallbackErr.code}${fallbackErr.status ? ` HTTP ${fallbackErr.status}` : ""}`
            : "unexpected"
        } model=${fallback.model}`,
      );
      // A timeout means the shared budget is spent; otherwise the primary's error is the one
      // that explains the outage, and it already reads as a temporary hiccup.
      if (fallbackErr instanceof AiError && fallbackErr.code === "timeout") throw fallbackErr;
      throw err;
    }
  }
}
