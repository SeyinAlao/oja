import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chat, endpointInfo } from "./ai-client";

const messages = [{ role: "user" as const, content: "hi" }];
const okBody = { choices: [{ message: { content: '{"ok":true}' } }] };

function okResponse() {
  return new Response(JSON.stringify(okBody), { status: 200 });
}

beforeEach(() => {
  vi.stubEnv("AI_BASE_URL", "");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_API_KEY", "");
  vi.stubEnv("AI_TIMEOUT_SECONDS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("endpointInfo", () => {
  it("defaults to local Ollama and gemma3:4b", () => {
    expect(endpointInfo()).toEqual({ model: "gemma3:4b", local: true });
  });

  it.each(["http://localhost:11434/v1", "http://127.0.0.1:8080/v1", "http://[::1]:11434/v1"])(
    "treats %s as local",
    (url) => {
      vi.stubEnv("AI_BASE_URL", url);
      expect(endpointInfo().local).toBe(true);
    },
  );

  it("treats a remote host as hosted and never leaks the URL or key", () => {
    vi.stubEnv("AI_BASE_URL", "https://api.example.com/v1");
    vi.stubEnv("AI_MODEL", "some/model");
    vi.stubEnv("AI_API_KEY", "super-secret-key");
    const info = endpointInfo();
    expect(info).toEqual({ model: "some/model", local: false });
    expect(JSON.stringify(info)).not.toMatch(/example|secret/);
  });

  it("does not treat a lookalike host as local", () => {
    vi.stubEnv("AI_BASE_URL", "https://localhost.evil.example/v1");
    expect(endpointInfo().local).toBe(false);
  });
});

describe("chat", () => {
  it("sends a Bearer token when AI_API_KEY is set", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_BASE_URL", "https://api.example.com/v1/");
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(chat(messages)).resolves.toBe('{"ok":true}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("sends no Authorization header without a key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await chat(messages);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("maps an abort/timeout to code timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    await expect(chat(messages)).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps a network failure to code unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(chat(messages)).rejects.toMatchObject({ code: "unreachable" });
  });

  it("maps a non-200 to code upstream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(chat(messages)).rejects.toMatchObject({ code: "upstream" });
  });

  it("maps an empty reply to code bad_output", async () => {
    const empty = { choices: [{ message: { content: "  " } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(empty))));
    await expect(chat(messages)).rejects.toMatchObject({ code: "bad_output" });
  });
});
