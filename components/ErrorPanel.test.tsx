import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorPanel } from "./ErrorPanel";

function html(error: string, message: string) {
  return renderToStaticMarkup(<ErrorPanel failure={{ error, message }} onRetry={() => {}} />);
}

describe("ErrorPanel copy", () => {
  it("explains how to start Ollama when the model is unreachable", () => {
    const out = html("unreachable", "Could not reach the model.");
    expect(out).toContain("can’t reach the AI model");
    expect(out).toContain("ollama serve");
    expect(out).toContain("ollama pull gemma3:4b");
  });

  it("reads as a temporary hiccup, with no Ollama steps, for a hosted model", () => {
    const out = renderToStaticMarkup(
      <ErrorPanel
        failure={{ error: "unreachable", message: "The AI service is temporarily unreachable." }}
        onRetry={() => {}}
        local={false}
      />,
    );
    expect(out).toContain("The AI service had a hiccup");
    expect(out).toContain("usually temporary");
    expect(out).not.toContain("ollama serve");
  });

  it("titles a 5xx upstream failure as a hiccup", () => {
    const out = html("upstream", "The AI service had a hiccup. Please try again in a moment.");
    expect(out).toContain("The AI service had a hiccup");
  });

  it("explains timeouts and how to raise the limit", () => {
    const out = html("timeout", "The model did not answer within 300 seconds.");
    expect(out).toContain("That took too long");
    expect(out).toContain("AI_TIMEOUT_SECONDS");
  });

  it("explains an oversized upload", () => {
    const out = html("too_large", "Those photos are too big. Try smaller ones.");
    expect(out).toContain("Those photos are too big");
    expect(out).toContain("Remove a photo");
  });

  it("explains the rate limit", () => {
    const out = html("rate_limited", "Too many requests.");
    expect(out).toContain("Slow down a little");
    expect(out).toContain("10 listings a minute");
  });

  it("shows a role=alert and a retry button for any failure", () => {
    const out = html("internal", "Oops");
    expect(out).toContain('role="alert"');
    expect(out).toContain("Try again");
  });
});
