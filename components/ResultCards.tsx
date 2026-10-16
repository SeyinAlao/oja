"use client";

import { motion } from "framer-motion";
import type { Ref, ReactNode } from "react";
import { NO_PRODUCT_PREFIX } from "@/lib/prompts";
import type { Listing } from "@/lib/schema";
import { CopyButton } from "./CopyButton";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function isNoProduct(listing: Listing): boolean {
  return listing.title.toLowerCase().startsWith(NO_PRODUCT_PREFIX.toLowerCase());
}

function Card({
  heading,
  copyText,
  index,
  onCopied,
  children,
}: {
  heading: string;
  copyText: string;
  index: number;
  onCopied: (label: string) => void;
  children: ReactNode;
}) {
  return (
    <motion.section
      aria-label={heading}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-forest/15 bg-paper p-5 shadow-[0_1px_0_rgb(15_61_46/0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-saffron-ink">{heading}</h3>
        <CopyButton text={copyText} label={heading.toLowerCase()} onCopied={onCopied} />
      </div>
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

type Props = {
  listing: Listing;
  ms: number;
  /** The model that actually served this listing (the fallback, when it was used). */
  model?: string;
  title?: string;
  /** Shown between the heading and the cards. */
  intro?: ReactNode;
  headingRef: Ref<HTMLHeadingElement>;
  /** Omit when there is nothing to regenerate, such as the saved example. */
  onRegenerate?: () => void;
  onCopied: (label: string) => void;
};

export function ResultCards({
  listing,
  ms,
  model,
  title = "Your listing",
  intro,
  headingRef,
  onRegenerate,
  onCopied,
}: Props) {
  if (isNoProduct(listing)) {
    return (
      <div className="rounded-2xl border border-saffron-deep/50 bg-paper p-5">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold text-forest"
        >
          We couldn’t see a product to list
        </h2>
        <p className="mt-1 text-ink">{listing.title.replace(/^[^:]*:\s*/, "")}</p>
        <p className="mt-2 text-sm text-muted">
          Try a clear, well-lit photo of the item on its own, then press the button again.
        </p>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn btn-solid mt-4">
            Try again
          </button>
        )}
      </div>
    );
  }

  const hashtags = listing.hashtags.join(" ");
  const price = listing.price_range_ngn;
  const priceText = `${naira(price.low)} – ${naira(price.high)}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(listing.whatsapp_status)}`;

  return (
    <div className="space-y-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl font-semibold text-forest"
      >
        {title}
      </h2>
      {intro}

      <Card heading="Title" copyText={listing.title} index={0} onCopied={onCopied}>
        <p className="font-display text-2xl font-semibold leading-snug text-forest">{listing.title}</p>
      </Card>

      <Card
        heading="Instagram caption"
        copyText={`${listing.caption}\n\n${hashtags}`}
        index={1}
        onCopied={onCopied}
      >
        <p className="whitespace-pre-line">{listing.caption}</p>
        <p className="mt-3 break-words text-sm font-medium text-forest-soft">{hashtags}</p>
      </Card>

      <Card heading="Description" copyText={listing.description} index={2} onCopied={onCopied}>
        <p className="whitespace-pre-line">{listing.description}</p>
      </Card>

      <Card
        heading="WhatsApp status"
        copyText={listing.whatsapp_status}
        index={3}
        onCopied={onCopied}
      >
        <p className="whitespace-pre-line rounded-xl bg-[#e6f2e3] p-3">{listing.whatsapp_status}</p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-solid mt-3"
        >
          Open in WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Card>

      <Card
        heading="Price guide"
        copyText={`${priceText}. ${price.note}`}
        index={4}
        onCopied={onCopied}
      >
        <p className="font-display text-2xl font-semibold text-forest">{priceText}</p>
        <p className="mt-1 text-sm text-muted">{price.note}</p>
        <p className="mt-2 text-sm text-muted">A rough guide only, not a guarantee.</p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn btn-outline">
            Regenerate
          </button>
        )}
        <p className="ml-auto text-xs text-muted">
          Written in {(ms / 1000).toFixed(1)}s{model ? ` by ${model}` : ""}
        </p>
      </div>
    </div>
  );
}
