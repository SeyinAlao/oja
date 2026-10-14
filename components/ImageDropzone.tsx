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
  const helpId = useId();
  const errorId = useId();
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
        role="group"
        aria-labelledby={`${inputId}-title`}
        aria-describedby={`${helpId} ${errorId}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full && !busy) onFiles(Array.from(e.dataTransfer.files));
        }}
        className={`mt-2 rounded-2xl border-2 border-dashed p-4 transition-colors ${
          dragging ? "border-saffron-deep bg-saffron/15" : "border-forest/30 bg-paper"
        }`}
      >
        <span id={`${inputId}-title`} className="sr-only">
          Photo upload area, {photos.length} of {max} photos added
        </span>
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
                <img
                  src={p.dataUrl}
                  alt={`Preview of product photo ${i + 1} of ${photos.length}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  disabled={busy}
                  aria-label={`Remove photo ${i + 1} of ${photos.length}`}
                  className="absolute right-0 top-0 grid size-11 cursor-pointer place-items-center disabled:cursor-not-allowed"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-forest text-lg leading-none text-cream shadow"
                  >
                    ×
                  </span>
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
                className="grid size-24 cursor-pointer place-items-center rounded-xl bg-sand text-center text-sm font-medium text-forest transition hover:bg-saffron/25 active:bg-saffron/40 disabled:cursor-not-allowed disabled:opacity-60 sm:size-28"
              >
                <span>
                  <span aria-hidden="true" className="block text-2xl leading-none">
                    +
                  </span>
                  {photos.length === 0 ? "Add photo" : "Add more"}
                  <span className="sr-only"> (opens your photo picker)</span>
                </span>
              </button>
            </li>
          )}
        </ul>

        <p id={helpId} className="mt-3 text-sm text-muted">
          {photos.length === 0
            ? `Tap or press the button to choose photos, or drag them here. Up to ${max}, JPEG, PNG or WebP. They are resized on your device and never stored.`
            : `Up to ${max} photos. Use the × on a photo to remove it.`}
        </p>
      </div>

      <p id={errorId} role="alert" className="mt-2 min-h-5 text-sm text-clay">
        {error}
      </p>
    </div>
  );
}
