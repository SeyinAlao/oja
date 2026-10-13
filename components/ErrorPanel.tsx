export type ApiFailure = { error: string; message: string };

export function ErrorPanel({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  const unreachable = failure.error === "unreachable";
  const timeout = failure.error === "timeout";

  return (
    <div role="alert" className="rounded-2xl border border-clay/40 bg-paper p-5">
      <h2 className="font-display text-xl font-semibold text-clay">
        {unreachable ? "Oja can’t reach the AI model" : timeout ? "That took too long" : "Something went wrong"}
      </h2>
      <p className="mt-1 text-ink">{failure.message}</p>

      {unreachable && (
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
      {timeout && (
        <p className="mt-3 text-sm text-muted">
          Small models on a laptop can be slow, especially the first time while they load. Try again, use
          fewer or smaller photos, or raise AI_TIMEOUT_SECONDS.
        </p>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-full bg-forest px-5 font-semibold text-cream hover:bg-forest-soft"
      >
        Try again
      </button>
    </div>
  );
}
