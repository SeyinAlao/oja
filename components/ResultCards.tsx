"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Listing } from "@/lib/schema";
import { CopyButton } from "./CopyButton";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function Card({
  heading,
  copyText,
  index,
  children,
}: {
  heading: string;
  copyText: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-forest/15 bg-paper p-5 shadow-[0_1px_0_rgb(15_61_46/0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-saffron-deep">{heading}</h3>
        <CopyButton text={copyText} label={heading.toLowerCase()} />
      </div>
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

export function ResultCards({
  listing,
  ms,
  onRegenerate,
}: {
  listing: Listing;
  ms: number;
  onRegenerate: () => void;
}) {
  const hashtags = listing.hashtags.join(" ");
  const price = listing.price_range_ngn;
  const priceText = `${naira(price.low)} – ${naira(price.high)}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(listing.whatsapp_status)}`;

  return (
    <div className="space-y-4">
      <Card heading="Title" copyText={listing.title} index={0}>
        <p className="font-display text-2xl font-semibold leading-snug text-forest">{listing.title}</p>
      </Card>

      <Card heading="Instagram caption" copyText={`${listing.caption}\n\n${hashtags}`} index={1}>
        <p className="whitespace-pre-line">{listing.caption}</p>
        <p className="mt-3 break-words text-sm font-medium text-forest-soft">{hashtags}</p>
      </Card>

      <Card heading="Description" copyText={listing.description} index={2}>
        <p className="whitespace-pre-line">{listing.description}</p>
      </Card>

      <Card heading="WhatsApp status" copyText={listing.whatsapp_status} index={3}>
        <p className="whitespace-pre-line rounded-xl bg-[#e6f2e3] p-3">{listing.whatsapp_status}</p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 font-semibold text-cream hover:bg-forest-soft"
        >
          Open in WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Card>

      <Card heading="Price guide" copyText={`${priceText}. ${price.note}`} index={4}>
        <p className="font-display text-2xl font-semibold text-forest">{priceText}</p>
        <p className="mt-1 text-sm text-muted">
          A rough guide only, not a guarantee. {price.note}
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onRegenerate}
          className="min-h-11 rounded-full border-2 border-forest px-5 font-semibold text-forest hover:bg-forest/10"
        >
          Regenerate
        </button>
        <p className="text-xs text-muted">Written in {(ms / 1000).toFixed(1)}s</p>
      </div>
    </div>
  );
}
