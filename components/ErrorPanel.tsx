import type { Ref } from "react";

export type ApiFailure = { error: string; message: string };

const TITLES: Record<string, string> = {
  unreachable: "Oja can’t reach the AI model",
  timeout: "That took too long",
  upstream: "The AI service had a hiccup",
  rate_limited: "Slow down a little",
  too_large: "Those photos are too big",
  bad_request: "Check your photos",
  bad_output: "The model gave a messy answer",
  network: "No connection to Oja",
};

export function errorTitle(code: string, local = true): string {
  // A hosted endpoint that cannot be reached is a temporary outage, not something to set up.
  if (code === "unreachable" && !local) return "The AI service had a hiccup";
  return TITLES[code] ?? "Something went wrong";
}

type Props = {
  failure: ApiFailure;
  onRetry: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Whether the configured model runs on this machine. Defaults to true. */
  local?: boolean;
};

export function ErrorPanel({ failure, onRetry, headingRef, local = true }: Props) {
  const { error } = failure;

  return (
    <div role="alert" className="rounded-2xl border border-clay/40 bg-paper p-5">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-xl font-semibold text-clay"
      >
        {errorTitle(error, local)}
      </h2>
      <p className="mt-1 text-ink">{failure.message}</p>

      {error === "unreachable" && !local && (
        <p className="mt-3 text-sm text-muted">
          This is usually temporary. Wait a moment and press Try again.
        </p>
      )}
      {error === "unreachable" && local && (
        <div className="mt-3 text-sm text-ink">
          <p>If you are running Oja on your own machine, start Ollama and make sure the model is there:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-forest p-3 text-cream">
            <code>{`ollama serve\nollama pull gemma3:4b`}</code>
          </pre>
          <p className="mt-2 text-muted">
            Using a hosted model instead? Check AI_BASE_URL and AI_API_KEY in your environment.
          </p>
        </div>
      )}
      {error === "timeout" && (
        <p className="mt-3 text-sm text-muted">
          Small models on a laptop can be slow, especially the first time while they load. Try again, use
          fewer or smaller photos, or raise AI_TIMEOUT_SECONDS.
        </p>
      )}
      {error === "too_large" && (
        <p className="mt-3 text-sm text-muted">Remove a photo or choose smaller ones, then try again.</p>
      )}
      {error === "rate_limited" && (
        <p className="mt-3 text-sm text-muted">
          You can write up to 10 listings a minute. Wait a few seconds and press Try again.
        </p>
      )}

      <button type="button" onClick={onRetry} className="btn btn-solid mt-4">
        Try again
      </button>
    </div>
  );
}
