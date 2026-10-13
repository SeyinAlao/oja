"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useRef, useState } from "react";

export type Photo = { id: string; dataUrl: string };

type Props = {
  photos: Photo[];
  max: number;
  busy: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function ImageDropzone({ photos, max, busy, error, onFiles, onRemove }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = photos.length >= max;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-sm font-semibold text-forest">
          Product photos
        </label>
        <span className="text-xs text-muted">
          {photos.length} of {max}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) onFiles(Array.from(e.dataTransfer.files));
        }}
        className={`mt-2 rounded-2xl border-2 border-dashed p-4 transition-colors ${
          dragging ? "border-saffron-deep bg-saffron/15" : "border-forest/30 bg-paper"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          disabled={full || busy}
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        <ul className="flex flex-wrap gap-3" aria-label="Selected photos">
          <AnimatePresence initial={false}>
            {photos.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="relative size-24 overflow-hidden rounded-xl bg-sand sm:size-28"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                <img src={p.dataUrl} alt={`Product photo ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  disabled={busy}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-forest text-lg leading-none text-cream shadow"
                >
                  ×
                </button>
              </motion.li>
            ))}
          </AnimatePresence>

          {!full && (
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="grid size-24 place-items-center rounded-xl bg-sand text-center text-sm font-medium text-forest transition hover:bg-saffron/25 sm:size-28"
              >
                <span>
                  <span aria-hidden="true" className="block text-2xl leading-none">
                    +
                  </span>
                  {photos.length === 0 ? "Add photo" : "Add more"}
                </span>
              </button>
            </li>
          )}
        </ul>

        {photos.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Tap to choose, or drag photos here. Up to {max}, they are resized on your phone and never
            stored.
          </p>
        )}
      </div>

      <p role="alert" className="mt-2 min-h-5 text-sm text-clay">
        {error}
      </p>
    </div>
  );
}
