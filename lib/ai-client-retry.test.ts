import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chat, retryDelayMs } from "./ai-client";

const messages = [{ role: "user" as const, content: "hi" }];
const okBody = { choices: [{ message: { content: '{"ok":true}' } }] };

const res = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? JSON.stringify(okBody) : "x", { status, headers });

type Outcome = { ok: true; v: string } | { ok: false; e: Error & { code?: string } };

/** Runs chat() under fake timers, letting the retry delay elapse. */
async function run(fetchMock: ReturnType<typeof vi.fn>, advanceMs = 3500): Promise<Outcome> {
  vi.stubGlobal("fetch", fetchMock);
  const outcome: Promise<Outcome> = chat(messages).then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.advanceTimersByTimeAsync(advanceMs);
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("AI_BASE_URL", "");
  vi.stubEnv("AI_API_KEY", "");
  vi.stubEnv("AI_TIMEOUT_SECONDS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("one retry on transient upstream failures", () => {
  it("retries a 502 once and succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(502)).mockResolvedValueOnce(res(200));
    expect(await run(fetchMock)).toMatchObject({ ok: true, v: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 500 once and succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200));
    expect(await run(fetchMock)).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits for Retry-After on a 429, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal("fetch", fetchMock);
    const p = chat(messages);
    await vi.advanceTimersByTimeAsync(1900);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Retry-After: 2 means no retry yet
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a non-timeout network error once and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(res(200));
    expect(await run(fetchMock)).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps two consecutive 500s to the upstream error with a plain message", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => res(500));
    const out = await run(fetchMock);
    expect(out).toMatchObject({ ok: false, e: { code: "upstream" } });
    if (!out.ok) {
      expect(out.e.message).toBe("The AI service had a hiccup. Please try again in a moment.");
      expect(out.e.message).not.toMatch(/500/);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(400));
    expect(await run(fetchMock)).toMatchObject({ ok: false, e: { code: "upstream" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a timeout", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError"));
    expect(await run(fetchMock)).toMatchObject({ ok: false, e: { code: "timeout" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one timeout signal between both attempts, so the budget is not extended", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    await run(fetchMock);
    const [first, second] = fetchMock.mock.calls.map((c) => c[1].signal);
    expect(first).toBe(second);
  });

  it("logs only status codes and attempt numbers, never the key", async () => {
    vi.stubEnv("AI_API_KEY", "secret-key-value");
    const warn = vi.mocked(console.warn);
    await run(vi.fn().mockImplementation(async () => res(500)));
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/HTTP 500, retrying: attempt=1/);
    expect(logged).not.toContain("secret-key-value");
  });
});

describe("retryDelayMs", () => {
  it("is 800-1500 ms with jitter when there is no Retry-After", () => {
    expect(retryDelayMs(null, () => 0)).toBe(800);
    expect(retryDelayMs(null, () => 0.999)).toBeLessThanOrEqual(1500);
    expect(retryDelayMs(null, () => 0.5)).toBe(1150);
  });

  it("honours Retry-After seconds", () => {
    expect(retryDelayMs("1")).toBe(1000);
  });

  it("caps Retry-After at 3 seconds", () => {
    expect(retryDelayMs("120")).toBe(3000);
  });

  it("reads an HTTP-date Retry-After and caps it", () => {
    const now = Date.parse("2026-10-14T10:00:00Z");
    expect(retryDelayMs("Wed, 14 Oct 2026 10:00:02 GMT", Math.random, () => now)).toBe(2000);
    expect(retryDelayMs("Wed, 14 Oct 2026 11:00:00 GMT", Math.random, () => now)).toBe(3000);
  });

  it("falls back to jitter on a garbage header", () => {
    expect(retryDelayMs("soon", () => 0)).toBe(800);
  });
});
