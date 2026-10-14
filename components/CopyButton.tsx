"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  /** Field name, used in the accessible name and the "Copied" announcement. */
  label: string;
  onCopied: (label: string) => void;
};

export function CopyButton({ text, label, onCopied }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context; fall back for plain-http LAN testing.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    onCopied(label);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={`btn btn-chip ${copied ? "border-forest! bg-forest! text-cream!" : ""}`}
    >
      {/* The spoken confirmation comes from the page's live region, so this stays silent. */}
      <span aria-hidden="true">{copied ? "Copied ✓" : "Copy"}</span>
    </button>
  );
}
