"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { resizeToDataUrl } from "@/lib/resize-image";
import type { Listing, Style } from "@/lib/schema";
import { ErrorPanel, type ApiFailure } from "./ErrorPanel";
import { ImageDropzone, type Photo } from "./ImageDropzone";
import { LoadingState } from "./LoadingState";
import { ModelBadge, type ModelInfo } from "./ModelBadge";
import { ResultCards } from "./ResultCards";
import { StylePicker } from "./StylePicker";

const MAX_PHOTOS = 3;

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; listing: Listing; ms: number }
  | { kind: "error"; failure: ApiFailure };

const field =
  "mt-1.5 w-full min-h-11 rounded-xl border border-forest/30 bg-paper px-3 text-ink placeholder:text-muted";

export function Studio() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");
  const [style, setStyle] = useState<Style>("english");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // A one-off read of which model is configured; not server data worth a cache.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.model === "string") setModelInfo({ model: d.model, local: Boolean(d.local) });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const loading = outcome.kind === "loading";

  async function addFiles(files: File[]) {
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
    const added: Photo[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      try {
        added.push({ id: crypto.randomUUID(), dataUrl: await resizeToDataUrl(file) });
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : "Could not read that photo.");
      }
    }
    if (added.length) setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
  }

  async function generate() {
    if (photos.length === 0) {
      setPhotoError("Add at least one product photo first.");
      return;
    }
    setOutcome({ kind: "loading" });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: photos.map((p) => p.dataUrl),
          hints: { name, condition, price },
          style,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.listing) {
        setOutcome({
          kind: "error",
          failure:
            data && typeof data.error === "string" && typeof data.message === "string"
              ? (data as ApiFailure)
              : { error: "internal", message: `Oja answered with an unexpected error (HTTP ${res.status}).` },
        });
        return;
      }
      setOutcome({ kind: "done", listing: data.listing, ms: data.ms });
    } catch {
      setOutcome({
        kind: "error",
        failure: { error: "network", message: "Could not reach Oja. Check your connection and try again." },
      });
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-6">
        <ModelBadge info={modelInfo} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <ImageDropzone
            photos={photos}
            max={MAX_PHOTOS}
            busy={loading}
            error={photoError}
            onFiles={(f) => void addFiles(f)}
            onRemove={(id) => setPhotos((p) => p.filter((x) => x.id !== id))}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="hint-name" className="text-sm font-semibold text-forest">
                What is it? <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="hint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Ankara tote bag"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="hint-condition" className="text-sm font-semibold text-forest">
                Condition <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="hint-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                maxLength={60}
                placeholder="Brand new, UK used…"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="hint-price" className="text-sm font-semibold text-forest">
                Price in mind <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="hint-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                maxLength={40}
                inputMode="numeric"
                placeholder="₦15,000"
                className={field}
              />
            </div>
          </div>

          <StylePicker value={style} onChange={setStyle} disabled={loading} />

          <button
            type="submit"
            disabled={loading}
            className="min-h-13 w-full rounded-full bg-saffron px-6 py-3 text-lg font-bold text-forest shadow-[0_3px_0_var(--color-saffron-deep)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-70"
          >
            {loading ? "Writing your listing…" : outcome.kind === "done" ? "Write it again" : "Write my listing"}
          </button>
        </form>

        <div ref={resultRef} className="scroll-mt-4" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={outcome.kind}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {outcome.kind === "idle" && <EmptyState />}
              {outcome.kind === "loading" && <LoadingState local={modelInfo?.local ?? false} />}
              {outcome.kind === "error" && (
                <ErrorPanel failure={outcome.failure} onRetry={() => void generate()} />
              )}
              {outcome.kind === "done" && (
                <ResultCards
                  listing={outcome.listing}
                  ms={outcome.ms}
                  onRegenerate={() => void generate()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-forest/25 p-8 text-center">
      <p className="font-display text-2xl font-semibold text-forest">Your listing will show up here</p>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        A title, an Instagram caption with hashtags, a description, a WhatsApp status and a rough price
        guide, all ready to copy.
      </p>
    </div>
  );
}
