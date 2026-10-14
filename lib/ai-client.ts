export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

export type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export type AiErrorCode = "unreachable" | "timeout" | "upstream" | "bad_output";

export class AiError extends Error {
  /** HTTP status of the upstream answer, when there was one. */
  readonly status?: number;
  /** True for 429, 5xx and non-timeout network failures: the cases a fallback model may cover. */
  readonly fallbackEligible: boolean;

  constructor(
    readonly code: AiErrorCode,
    message: string,
    options: { status?: number; fallbackEligible?: boolean } = {},
  ) {
    super(message);
    this.name = "AiError";
    this.status = options.status;
    this.fallbackEligible = options.fallbackEligible ?? false;
  }
}

export type Endpoint = { baseUrl: string; model: string; apiKey: string };

// Enough for the whole JSON object; keeps a runaway small model from rambling.
export const DEFAULT_MAX_TOKENS = 900;

const trimSlash = (url: string) => url.trim().replace(/\/+$/, "");

export function aiConfig() {
  const baseUrl = trimSlash(process.env.AI_BASE_URL || "http://localhost:11434/v1");
  const model = process.env.AI_MODEL || "gemma3:4b";
  const apiKey = process.env.AI_API_KEY || "";

  // The fallback is off unless AI_FALLBACK_MODEL is set.
  const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim() || "";
  const fallbackBase = trimSlash(process.env.AI_FALLBACK_BASE_URL || "");
  const sameHost = !fallbackBase || fallbackBase === baseUrl;
  const fallback: Endpoint | null = fallbackModel
    ? {
        model: fallbackModel,
        baseUrl: fallbackBase || baseUrl,
        // The primary key is only reused when the fallback is on the same base URL,
        // so it can never be sent to a different host by default.
        apiKey: process.env.AI_FALLBACK_API_KEY || (sameHost ? apiKey : ""),
      }
    : null;

  return {
    baseUrl,
    model,
    apiKey,
    fallback,
    timeoutMs: (Number(process.env.AI_TIMEOUT_SECONDS) || 300) * 1000,
    // Optional: only sent when set, because not every endpoint accepts it.
    reasoningEffort: process.env.AI_REASONING_EFFORT?.trim() || "",
    maxTokens: Number(process.env.AI_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    // An unparseable URL is treated as hosted; requests will fail as "unreachable".
    return false;
  }
}

/** Safe-to-expose summary of the configuration: never a URL or a key. */
export function endpointInfo(): { model: string; local: boolean; fallback_configured: boolean } {
  const { baseUrl, model, fallback } = aiConfig();
  return { model, local: isLocalUrl(baseUrl), fallback_configured: fallback !== null };
}

const RETRY_BASE_MS = 800;
const RETRY_JITTER_MS = 700;
const MAX_RETRY_WAIT_MS = 3000;

const isTimeout = (err: unknown) =>
  err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

/** Worth a retry or a fallback: rate limits and server-side hiccups, never other 4xx. */
const isTransientStatus = (status: number) => status === 429 || status >= 500;

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

type ChatOptions = {
  /** Shared deadline: every call of one request, retries and fallback included, stops here. */
  signal: AbortSignal;
  timeoutMs: number;
  /** One retry on 429, 5xx and non-timeout network errors. */
  retry: boolean;
};

/** Builds a chat function bound to one endpoint, with the config's token and effort settings. */
export function createChat(endpoint: Endpoint, options: ChatOptions): ChatFn {
  const { reasoningEffort, maxTokens } = aiConfig();
  const { model, baseUrl, apiKey } = endpoint;
  const maxAttempts = options.retry ? 2 : 1;

  return async (messages) => {
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
      signal: options.signal,
    };
    const timeoutError = () =>
      new AiError(
        "timeout",
        `The model did not answer within ${Math.round(options.timeoutMs / 1000)} seconds.`,
      );

    let res: Response | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        res = await fetch(`${baseUrl}/chat/completions`, request);
      } catch (err) {
        if (isTimeout(err)) throw timeoutError();
        if (attempt === maxAttempts) {
          console.warn(`[oja] model call failed (network): attempt=${attempt} model=${model}`);
          throw new AiError(
            "unreachable",
            isLocalUrl(baseUrl)
              ? "Could not reach the AI model."
              : "The AI service is temporarily unreachable. Please try again in a moment.",
            { fallbackEligible: true },
          );
        }
        console.warn(`[oja] model call failed (network), retrying: attempt=${attempt} model=${model}`);
        await sleep(retryDelayMs(null));
        continue;
      }
      if (res.ok || attempt === maxAttempts || !isTransientStatus(res.status)) break;
      console.warn(
        `[oja] model call returned HTTP ${res.status}, retrying: attempt=${attempt} model=${model}`,
      );
      const wait = retryDelayMs(res.headers.get("retry-after"));
      await res.body?.cancel().catch(() => {});
      await sleep(wait);
    }

    if (!res || !res.ok) {
      const status = res?.status ?? 0;
      console.warn(`[oja] model call failed: HTTP ${status} model=${model}`);
      throw new AiError("upstream", upstreamMessage(status), {
        status,
        fallbackEligible: isTransientStatus(status),
      });
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
}

/** The primary model with its own deadline per call; kept for callers and tests that need one call. */
export const chat: ChatFn = (messages) => {
  const { baseUrl, model, apiKey, timeoutMs } = aiConfig();
  return createChat(
    { baseUrl, model, apiKey },
    { signal: AbortSignal.timeout(timeoutMs), timeoutMs, retry: true },
  )(messages);
};
