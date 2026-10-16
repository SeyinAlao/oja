"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import type { Style } from "@/lib/schema";

const OPTIONS: { value: Style; label: string; sample: string }[] = [
  { value: "english", label: "Clear English", sample: "Fresh, clean, ready to ship." },
  { value: "pidgin", label: "Naija Pidgin", sample: "E dey fine well well!" },
  { value: "yoruba", label: "Yoruba-flavoured", sample: "E káàbọ̀, come and see." },
];

export const styleLabel = (style: Style) => OPTIONS.find((o) => o.value === style)?.label ?? style;

/**
 * Native radio inputs in one named group: screen readers announce a radio group, Tab enters it
 * once, and the arrow keys move the selection. The pill is decoration over the real controls.
 */
export function StylePicker({
  value,
  onChange,
  disabled,
}: {
  value: Style;
  onChange: (s: Style) => void;
  disabled: boolean;
}) {
  const group = useId();
  const sampleId = useId();
  const current = OPTIONS.find((o) => o.value === value);

  return (
    <fieldset role="radiogroup" disabled={disabled} aria-describedby={sampleId}>
      <legend className="text-sm font-semibold text-forest">Writing style</legend>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
        {OPTIONS.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className="relative flex min-h-11 items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-saffron-deep"
            >
              <input
                type="radio"
                name={group}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {selected && (
                <motion.span
                  aria-hidden="true"
                  layoutId="style-pill"
                  className="absolute inset-0 rounded-xl bg-forest"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span
                className={`relative ${selected ? "text-cream" : "text-forest"} ${
                  selected ? "" : "hover:underline"
                }`}
              >
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      <p id={sampleId} className="mt-2 text-sm italic text-muted">
        <span className="not-italic">Sounds like: </span>“{current?.sample}”
      </p>
    </fieldset>
  );
}
