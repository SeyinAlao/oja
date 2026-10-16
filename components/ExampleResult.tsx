import Image from "next/image";
import type { Ref } from "react";
import { formatSavedDate, savedExample } from "@/lib/example";
import type { Style } from "@/lib/schema";
import { ResultCards } from "./ResultCards";

type Props = {
  style: Style;
  headingRef: Ref<HTMLHeadingElement>;
  onCopied: (label: string) => void;
};

/** The saved listing for the chosen style. Pure presentation: no request is made. */
export function ExampleResult({ style, headingRef, onCopied }: Props) {
  const result = savedExample.results[style];

  return (
    <ResultCards
      title="Example listing"
      listing={result.listing}
      ms={result.ms}
      model={result.model}
      headingRef={headingRef}
      onCopied={onCopied}
      intro={
        <div className="flex items-center gap-4 rounded-2xl border border-saffron-deep/50 bg-paper p-4">
          <Image
            src={savedExample.photo}
            alt="Example product photo: a jar of Blue Pearl cherry jam"
            width={54}
            height={96}
            className="h-24 w-auto shrink-0 rounded-lg object-cover"
          />
          <p className="text-sm text-ink">
            <strong className="font-semibold text-forest">Saved example</strong>, written by{" "}
            {result.model} on {formatSavedDate(result.generatedAt)}, not a live generation. Switch
            the writing style to see the other versions, or add your own photo to write a real
            listing.
          </p>
        </div>
      }
    />
  );
}
