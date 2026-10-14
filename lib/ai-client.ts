export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

export type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export class AiError extends Error {
  constructor(
    readonly code: "unreachable" | "timeout" | "upstream" | "bad_output",
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

// Enough for the whole JSON object; keeps a runaway small model from rambling.
export const DEFAULT_MAX_TOKENS = 900;

export function aiConfig() {
  return {
    baseUrl: (process.env.AI_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL || "gemma3:4b",
    apiKey: process.env.AI_API_KEY || "",
    timeoutMs: (Number(process.env.AI_TIMEOUT_SECONDS) || 300) * 1000,
    // Optional: only sent when set, because not every endpoint accepts it.
    reasoningEffort: process.env.AI_REASONING_EFFORT?.trim() || "",
    maxTokens: Number(process.env.AI_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/** Safe-to-expose summary of the configured model: never the URL or key. */
export function endpointInfo(): { model: string; local: boolean } {
  const { baseUrl, model } = aiConfig();
  let host = "";
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    // An unparseable URL is treated as hosted; requests will fail as "unreachable".
  }
  return { model, local: LOCAL_HOSTS.has(host) };
}

const RETRY_BASE_MS = 800;
const RETRY_JITTER_MS = 700;
const MAX_RETRY_WAIT_MS = 3000;

const isTimeout = (err: unknown) =>
  err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

/** One retry is worth it for rate limits and server-side hiccups, never for 4xx or timeouts. */
const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/**
 * Wait before the single retry: 800-1500 ms with jitter, or the server's Retry-After
 * (seconds or an HTTP date) when present, never more than 3 seconds.
 */
export function retryDelayMs(
  retryAfter: string | null,
  random: () => number = Math.random,
  now: () => number = Date.now,
): number {
  const jittered = RETRY_BASE_MS + Math.floor(random() * RETRY_JITTER_MS);
  const value = retryAfter?.trim();
  if (!value) return jittered;
  let seconds = NaN;
  if (/^\d+$/.test(value)) seconds = Number(value);
  else {
    const at = Date.parse(value);
    if (!Number.isNaN(at)) seconds = (at - now()) / 1000;
  }
  if (!Number.isFinite(seconds)) return jittered;
  return Math.min(Math.max(seconds * 1000, 0), MAX_RETRY_WAIT_MS);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function upstreamMessage(status: number): string {
  if (status >= 500) return "The AI service had a hiccup. Please try again in a moment.";
  if (status === 429) return "The AI service is busy right now. Please try again in a moment.";
  return `The model server answered with HTTP ${status}.`;
}

export const chat: ChatFn = async (messages) => {
  const { baseUrl, model, apiKey, timeoutMs, reasoningEffort, maxTokens } = aiConfig();
  // One deadline for both attempts, so a retry can never extend the overall budget.
  const signal = AbortSignal.timeout(timeoutMs);
  const request: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: false,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    }),
    signal,
  };

  let res: Response | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await fetch(`${baseUrl}/chat/completions`, request);
    } catch (err) {
      if (isTimeout(err)) {
        throw new AiError(
          "timeout",
          `The model did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
        );
      }
      if (attempt === 2) throw new AiError("unreachable", "Could not reach the AI model.");
      console.warn(`[oja] model call failed (network), retrying: attempt=${attempt}`);
      await sleep(retryDelayMs(null));
      continue;
    }
    if (res.ok || attempt === 2 || !isRetryableStatus(res.status)) break;
    console.warn(`[oja] model call returned HTTP ${res.status}, retrying: attempt=${attempt}`);
    const wait = retryDelayMs(res.headers.get("retry-after"));
    await res.body?.cancel().catch(() => {});
    await sleep(wait);
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    console.warn(`[oja] model call failed: HTTP ${status}`);
    throw new AiError("upstream", upstreamMessage(status));
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiError("bad_output", "The model returned an empty reply.");
  }
  return content;
};
