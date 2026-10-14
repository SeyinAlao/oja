import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("reports ok, the model and whether it is local", async () => {
    const data = await (await GET()).json();
    expect(data).toEqual({ ok: true, model: "gemma3:4b", local: true, fallback_configured: false });
  });

  it("never exposes the key or the endpoint URL", async () => {
    vi.stubEnv("AI_BASE_URL", "https://hosted.example.com/v1");
    vi.stubEnv("AI_API_KEY", "sk-should-never-appear");
    vi.stubEnv("AI_MODEL", "google/gemma-3-27b-it");
    const raw = JSON.stringify(await (await GET()).json());
    expect(raw).toContain('"local":false');
    expect(raw).not.toMatch(/sk-should|hosted\.example/);
  });
});
