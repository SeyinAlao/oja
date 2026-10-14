import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const MB = 1024 * 1024;
let ipCounter = 0;

function req(body: unknown, headers: Record<string, string> = {}, ip?: string) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { images: ["data:image/jpeg;base64,AAAA"], hints: {}, style: "english" };
const listing = {
  title: "Tote",
  caption: "Nice bag. DM to order.",
  description: "A bag.",
  hashtags: ["#bag"],
  whatsapp_status: "Bag. DM to order.",
  price_range_ngn: { low: 1000, high: 2000, note: "Rough guide." },
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/generate error paths", () => {
  it("maps two upstream 503s to 502 with a plain 'hiccup' message and no status code", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("x", { status: 503 })));
    const pending = POST(req(valid));
    await vi.advanceTimersByTimeAsync(3000);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe("upstream");
    expect(data.message).toMatch(/hiccup.*try again in a moment/i);
    expect(data.message).not.toMatch(/503/);
  });

  it("returns 429 with Retry-After once the limit is exceeded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })));
    const ip = "203.0.113.9";
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) last = await POST(req("not json", {}, ip));
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await last!.json()).toMatchObject({ error: "rate_limited" });
  });

  it("returns 413 when Content-Length is over the limit", async () => {
    const res = await POST(req(valid, { "content-length": String(7 * MB) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "too_large" });
  });

  it("returns 413 when the actual body is over the limit", async () => {
    const res = await POST(req("x".repeat(6 * MB + 1)));
    expect(res.status).toBe(413);
  });

  it("returns 400 for invalid JSON and for a missing image", async () => {
    expect((await POST(req("{nope"))).status).toBe(400);
    const none = await POST(req({ ...valid, images: [] }));
    expect(none.status).toBe(400);
    expect(await none.json()).toMatchObject({ error: "bad_request" });
  });

  it("returns 504 timeout when the upstream times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    const res = await POST(req(valid));
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.error).toBe("timeout");
    expect(data.message).toMatch(/did not answer within \d+ seconds/);
  });

  it("returns 502 unreachable when the model cannot be reached, without leaking the URL", async () => {
    vi.stubEnv("AI_BASE_URL", "https://secret-host.example/v1");
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const pending = POST(req(valid));
    await vi.advanceTimersByTimeAsync(3000);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("unreachable");
    expect(text).not.toContain("secret-host");
    vi.unstubAllEnvs();
  });

  it("returns 502 bad_output after one repair attempt on garbage replies", async () => {
    const garbage = { choices: [{ message: { content: "I cannot do that" } }] };
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(garbage)));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req(valid));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("bad_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the listing, ms and model on success", async () => {
    const body = { choices: [{ message: { content: JSON.stringify(listing) } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.listing.title).toBe("Tote");
    expect(typeof data.ms).toBe("number");
    expect(data.model).toBe("gemma3:4b");
  });
});
