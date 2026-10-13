export type ModelInfo = { model: string; local: boolean };

export function ModelBadge({ info }: { info: ModelInfo | null }) {
  if (!info) return <span className="skeleton h-7 w-44 rounded-full" aria-hidden="true" />;

  return (
    <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-forest/25 bg-paper px-3 py-1 text-xs text-forest">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${info.local ? "bg-forest-soft" : "bg-saffron"}`}
      />
      <span className="truncate font-semibold">{info.model}</span>
      <span className="shrink-0 text-muted">
        {info.local ? "locally on your machine" : "hosted open-weight endpoint"}
      </span>
    </p>
  );
}
