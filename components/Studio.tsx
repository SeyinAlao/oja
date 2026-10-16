"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildHints, type HintFields } from "@/lib/hints";
import { resizeToDataUrl } from "@/lib/resize-image";
import type { Listing, Style } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { ErrorPanel, type ApiFailure } from "./ErrorPanel";
import { ExampleResult } from "./ExampleResult";
import { HintInputs } from "./HintInputs";
import { ImageDropzone, type Photo } from "./ImageDropzone";
import { LoadingState } from "./LoadingState";
import { ModelBadge, type ModelInfo } from "./ModelBadge";
import { ResultCards } from "./ResultCards";
import { StylePicker, styleLabel } from "./StylePicker";

const MAX_PHOTOS = 3;

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; listing: Listing; ms: number; model: string }
  | { kind: "example" }
  | { kind: "error"; failure: ApiFailure };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Studio() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [hints, setHints] = useState<HintFields>({ name: "", condition: "", price: "" });
  const [style, setStyle] = useState<Style>("english");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const announceCount = useRef(0);

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

  // The results or error heading mounts only after the old panel finishes animating out, so
  // focus it from a callback ref at mount time. Keyboard and screen-reader users land on the
  // outcome, and Tab continues from there: nothing is trapped.
  const headingRef = useCallback((el: HTMLHeadingElement | null) => {
    el?.focus({ preventScroll: true });
  }, []);

  const loading = outcome.kind === "loading";

  /** Polite live-region message; a trailing NBSP on alternate calls lets repeats be re-read. */
  function announce(text: string) {
    announceCount.current += 1;
    setAnnouncement(announceCount.current % 2 === 0 ? `${text} ` : text);
  }

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
    if (added.length) {
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
      setOutcome((o) => (o.kind === "example" ? { kind: "idle" } : o));
      announce(`${added.length} photo${added.length === 1 ? "" : "s"} added`);
    }
  }

  function showExample() {
    setOutcome({ kind: "example" });
    announce("Example loaded");
  }

  function changeStyle(next: Style) {
    setStyle(next);
    if (outcome.kind === "example") announce(`Example switched to ${styleLabel(next)}`);
  }

  async function generate() {
    if (loading) return;
    if (photos.length === 0) {
      setPhotoError("Add at least one product photo first.");
      return;
    }
    setOutcome({ kind: "loading" });
    announce("Writing your listing");
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      }),
    );
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: photos.map((p) => p.dataUrl),
          hints: buildHints(hints),
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
      setOutcome({
        kind: "done",
        listing: data.listing,
        ms: data.ms,
        model: typeof data.model === "string" ? data.model : "",
      });
      announce("Listing ready");
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

      {/* One polite live region for the whole page: progress, results and copy confirmations. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
        <form
          aria-labelledby="form-title"
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <h2 id="form-title" className="sr-only">
            Describe your product
          </h2>

          <ImageDropzone
            photos={photos}
            max={MAX_PHOTOS}
            busy={loading}
            error={photoError}
            onFiles={(f) => void addFiles(f)}
            onRemove={(id) => {
              setPhotos((p) => p.filter((x) => x.id !== id));
              announce("Photo removed");
            }}
          />

          <HintInputs value={hints} onChange={setHints} />

          <StylePicker value={style} onChange={changeStyle} disabled={loading} />

          <button
            type="submit"
            aria-disabled={loading}
            className="btn btn-cta min-h-13 w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
          >
            {loading ? "Writing your listing…" : outcome.kind === "done" ? "Write it again" : "Write my listing"}
          </button>
        </form>

        <div ref={resultRef} className="scroll-mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={outcome.kind}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {outcome.kind === "idle" && <EmptyState onTryExample={showExample} />}
              {outcome.kind === "example" && (
                <ExampleResult
                  style={style}
                  headingRef={headingRef}
                  onCopied={(label) => announce(`Copied ${label}`)}
                />
              )}
              {outcome.kind === "loading" && <LoadingState local={modelInfo?.local ?? false} />}
              {outcome.kind === "error" && (
                <ErrorPanel
                  failure={outcome.failure}
                  local={modelInfo ? modelInfo.local : true}
                  headingRef={headingRef}
                  onRetry={() => void generate()}
                />
              )}
              {outcome.kind === "done" && (
                <ResultCards
                  listing={outcome.listing}
                  ms={outcome.ms}
                  model={outcome.model}
                  headingRef={headingRef}
                  onRegenerate={() => void generate()}
                  onCopied={(label) => announce(`Copied ${label}`)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
