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

export function aiConfig() {
  return {
    baseUrl: (process.env.AI_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL || "gemma3:4b",
    apiKey: process.env.AI_API_KEY || "",
    timeoutMs: (Number(process.env.AI_TIMEOUT_SECONDS) || 300) * 1000,
  };
}

// Enough for the whole JSON object; keeps a runaway small model from rambling.
const MAX_TOKENS = 900;

export const chat: ChatFn = async (messages) => {
  const { baseUrl, model, apiKey, timeoutMs } = aiConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AiError(
        "timeout",
        `The model did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
      );
    }
    throw new AiError("unreachable", `Could not reach the model at ${baseUrl}.`);
  }

  if (!res.ok) {
    throw new AiError("upstream", `The model server answered with HTTP ${res.status}.`);
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
