import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiConfig, endpointInfo } from "./ai-client";
import { generateWithFallback } from "./model-service";
import type { GenerateRequest } from "./schema";

const PRIMARY = "https://primary.example/v1";
const FALLBACK = "https://fallback.example/v1";

const listing = {
  title: "Tote",
  caption: "Nice bag. DM to order.",
  description: "A bag.",
  hashtags: ["#bag"],
  whatsapp_status: "Bag. DM to order.",
  price_range_ngn: { low: 1000, high: 2000, note: "Fabric and size." },
};

const request: GenerateRequest = { images: ["data:image/jpeg;base64,AAAA"], hints: {}, style: "english" };

const ok = (content = JSON.stringify(listing)) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const status = (code: number) => new Response("x", { status: code });

type Call = { url: string; auth: string | null };
let calls: Call[];

/** Routes fetch by host so primary and fallback can answer differently. */
function stubFetch(handlers: { primary: () => Response | Promise<Response>; fallback?: () => Response | Promise<Response> }) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, auth: headers.Authorization ?? null });
      if (url.startsWith(FALLBACK)) return (handlers.fallback ?? (() => status(500)))();
      return handlers.primary();
    }),
  );
}

const hits = (host: string) => calls.filter((c) => c.url.startsWith(host)).length;

/** Runs the service while letting retry delays elapse under fake timers. */
async function run() {
  const outcome = generateWithFallback(request).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(5000);
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("AI_BASE_URL", PRIMARY);
  vi.stubEnv("AI_MODEL", "primary-model");
  vi.stubEnv("AI_API_KEY", "primary-secret-key");
  vi.stubEnv("AI_FALLBACK_MODEL", "fallback-model");
  vi.stubEnv("AI_FALLBACK_BASE_URL", FALLBACK);
  vi.stubEnv("AI_FALLBACK_API_KEY", "fallback-secret-key");
  vi.stubEnv("AI_TIMEOUT_SECONDS", "");
  vi.stubEnv("AI_REASONING_EFFORT", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fallback model", () => {
  it("falls back when the primary fails twice with 500 and the fallback succeeds", async () => {
    stubFetch({ primary: () => status(500), fallback: () => ok() });
    const out = await run();
    expect(out).toMatchObject({ ok: true, value: { model: "fallback-model", fellBack: true } });
    expect(hits(PRIMARY)).toBe(2); // first call + its one retry
    expect(hits(FALLBACK)).toBe(1); // a single attempt, no HTTP retry
  });

  it("sends the fallback key only to the fallback host", async () => {
    stubFetch({ primary: () => status(502), fallback: () => ok() });
    await run();
    const primary = calls.filter((c) => c.url.startsWith(PRIMARY));
    const fallback = calls.filter((c) => c.url.startsWith(FALLBACK));
    expect(primary.every((c) => c.auth === "Bearer primary-secret-key")).toBe(true);
    expect(fallback.every((c) => c.auth === "Bearer fallback-secret-key")).toBe(true);
  });

  it("does not touch the fallback when the primary succeeds", async () => {
    stubFetch({ primary: () => ok(), fallback: () => ok() });
    const out = await run();
    expect(out).toMatchObject({ ok: true, value: { model: "primary-model", fellBack: false } });
    expect(hits(FALLBACK)).toBe(0);
  });

  it("returns the existing upstream error when both fail", async () => {
    stubFetch({ primary: () => status(500), fallback: () => status(500) });
    const out = await run();
    expect(out).toMatchObject({ ok: false, error: { code: "upstream", status: 500 } });
    if (!out.ok) {
      expect(out.error.message).toBe("The AI service had a hiccup. Please try again in a moment.");
    }
    expect(hits(PRIMARY)).toBe(2);
    expect(hits(FALLBACK)).toBe(1);
  });

  it("does not fall back on a primary 400", async () => {
    stubFetch({ primary: () => status(400), fallback: () => ok() });
    const out = await run();
    expect(out).toMatchObject({ ok: false, error: { code: "upstream", status: 400 } });
    expect(hits(PRIMARY)).toBe(1);
    expect(hits(FALLBACK)).toBe(0);
  });

  it("does not fall back on a timeout", async () => {
    stubFetch({
      primary: () => {
        throw new DOMException("t", "TimeoutError");
      },
      fallback: () => ok(),
    });
    const out = await run();
    expect(out).toMatchObject({ ok: false, error: { code: "timeout" } });
    expect(hits(FALLBACK)).toBe(0);
  });

  it("falls back on a persistent network error", async () => {
    stubFetch({
      primary: () => {
        throw new TypeError("fetch failed");
      },
      fallback: () => ok(),
    });
    const out = await run();
    expect(out).toMatchObject({ ok: true, value: { model: "fallback-model", fellBack: true } });
    expect(hits(PRIMARY)).toBe(2);
  });

  it("falls back on a 429 that persists through the retry", async () => {
    stubFetch({ primary: () => status(429), fallback: () => ok() });
    const out = await run();
    expect(out).toMatchObject({ ok: true, value: { fellBack: true } });
  });

  it("gives the fallback its own JSON repair call", async () => {
    let fallbackCalls = 0;
    stubFetch({
      primary: () => status(500),
      fallback: () => (++fallbackCalls === 1 ? ok("sorry, no json") : ok()),
    });
    const out = await run();
    expect(out).toMatchObject({ ok: true, value: { fellBack: true, attempts: 2 } });
    expect(hits(FALLBACK)).toBe(2);
  });

  it("makes at most 6 model calls in the worst case", async () => {
    // primary: invalid reply, then repair fails twice (500, retried 500) -> fallback: invalid, invalid.
    let primaryCalls = 0;
    stubFetch({
      primary: () => (++primaryCalls === 1 ? ok("not json") : status(500)),
      fallback: () => ok("still not json"),
    });
    await run();
    expect(hits(PRIMARY)).toBe(3);
    expect(hits(FALLBACK)).toBe(2);
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it("is disabled when AI_FALLBACK_MODEL is unset", async () => {
    vi.stubEnv("AI_FALLBACK_MODEL", "");
    stubFetch({ primary: () => status(500), fallback: () => ok() });
    const out = await run();
    expect(out).toMatchObject({ ok: false, error: { code: "upstream" } });
    expect(hits(FALLBACK)).toBe(0);
  });

  it("never writes keys to the logs", async () => {
    stubFetch({ primary: () => status(500), fallback: () => status(503) });
    await run();
    const logged = [console.warn, console.log, console.error]
      .flatMap((fn) => vi.mocked(fn).mock.calls)
      .map((c) => c.join(" "))
      .join("\n");
    expect(logged).toMatch(/trying fallback: model=fallback-model/);
    expect(logged).toMatch(/HTTP 500/);
    expect(logged).not.toMatch(/secret-key/);
    expect(logged).not.toContain("primary.example");
    expect(logged).not.toContain("fallback.example");
  });
});

describe("fallback configuration", () => {
  it("defaults the fallback base URL and key to the primary's when they are unset", () => {
    vi.stubEnv("AI_FALLBACK_BASE_URL", "");
    vi.stubEnv("AI_FALLBACK_API_KEY", "");
    expect(aiConfig().fallback).toEqual({
      model: "fallback-model",
      baseUrl: PRIMARY,
      apiKey: "primary-secret-key",
    });
  });

  it("does not reuse the primary key for a different fallback host", () => {
    vi.stubEnv("AI_FALLBACK_API_KEY", "");
    expect(aiConfig().fallback).toMatchObject({ baseUrl: FALLBACK, apiKey: "" });
  });

  it("reports fallback_configured as a boolean and nothing else about it", () => {
    expect(endpointInfo()).toEqual({
      model: "primary-model",
      local: false,
      fallback_configured: true,
    });
    vi.stubEnv("AI_FALLBACK_MODEL", "");
    expect(endpointInfo().fallback_configured).toBe(false);
    expect(JSON.stringify(endpointInfo())).not.toMatch(/secret|example|fallback-model/);
  });
});
