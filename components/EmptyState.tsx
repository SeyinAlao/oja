export function EmptyState({ onTryExample }: { onTryExample: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-forest/25 p-8 text-center">
      <h2 className="font-display text-2xl font-semibold text-forest">Your listing will show up here</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        A title, an Instagram caption with hashtags, a description, a WhatsApp status and a rough price
        guide, all ready to copy.
      </p>
      <button type="button" onClick={onTryExample} className="btn btn-outline mt-5">
        Try an example
      </button>
    </div>
  );
}
