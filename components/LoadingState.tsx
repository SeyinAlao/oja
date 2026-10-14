"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const MESSAGES = [
  "Looking closely at your photos…",
  "Picking out what buyers will notice…",
  "Writing the caption…",
  "Thinking about a fair price…",
  "Nearly there…",
];

function Bar({ w }: { w: string }) {
  return <div className={`skeleton h-3 rounded-full ${w}`} />;
}

export function LoadingState({ local }: { local: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Local CPU inference is slow, so pace the messages to match.
  const step = local ? 20 : 4;
  const i = Math.min(Math.floor(seconds / step), MESSAGES.length - 1);

  return (
    <div aria-busy="true">
      <h2 className="font-display text-2xl font-semibold text-forest">Writing your listing</h2>
      {/* Not a live region on purpose: the page announces "Writing your listing" once,
          and a message that changes every few seconds would be noise. */}
      <p className="mt-1 flex items-center gap-2 text-forest">
        <span className="inline-block size-2.5 animate-pulse rounded-full bg-saffron" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="font-medium"
          >
            {MESSAGES[i]}
          </motion.span>
        </AnimatePresence>
      </p>

      {local && (
        <div className="mt-3 rounded-xl bg-sand p-3 text-sm text-ink">
          <p>
            <span className="font-semibold text-forest">{seconds}s elapsed.</span> This model runs on your
            own machine, so on a CPU it usually takes a couple of minutes. A hosted endpoint takes seconds.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="rounded-2xl border border-forest/10 bg-paper p-5">
            <div className="skeleton h-4 w-24 rounded-full" />
            <div className="mt-4 space-y-2.5">
              <Bar w="w-full" />
              <Bar w="w-11/12" />
              <Bar w="w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
