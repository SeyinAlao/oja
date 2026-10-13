"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const MESSAGES = [
  "Looking closely at your photos…",
  "Picking out what buyers will notice…",
  "Writing the caption…",
  "Thinking about a fair price…",
  "Still working. Small models on a laptop can take a couple of minutes…",
];

function Bar({ w }: { w: string }) {
  return <div className={`skeleton h-3 rounded-full ${w}`} />;
}

export function LoadingState() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div aria-busy="true">
      <p className="flex items-center gap-2 text-forest" role="status">
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
