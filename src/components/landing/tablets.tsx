"use client";

import { motion, useScroll, useTransform } from "motion/react";

type Tint = "teal" | "emerald" | "sky" | "amber";

const GRADIENTS: Record<Tint, string> = {
  teal: "from-[#002a68] to-[#0d4f9e]",
  emerald: "from-[#0d4f9e] to-[#3f8bd8]",
  sky: "from-[#3f8bd8] to-[#7cb9f0]",
  amber: "from-[#7cb9f0] to-[#aee3fd]",
};

/** Two-tone capsule tablet. */
export function Capsule({
  className = "",
  tint = "teal",
}: {
  className?: string;
  tint?: Tint;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className={`h-full w-full rounded-full bg-gradient-to-br ${GRADIENTS[tint]} shadow-xl shadow-slate-900/20 ring-1 ring-white/30`}
      >
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
        <div className="absolute left-3 top-2 h-[38%] w-[30%] rounded-full bg-white/45 blur-[1px]" />
        <div className="absolute bottom-2 right-4 h-[16%] w-[22%] rounded-full bg-black/10 blur-[1px]" />
      </div>
    </div>
  );
}

/** Round scored tablet. */
export function RoundTablet({
  className = "",
  tint = "teal",
}: {
  className?: string;
  tint?: Tint;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className={`h-full w-full rounded-full bg-gradient-to-br ${GRADIENTS[tint]} shadow-xl shadow-slate-900/20 ring-1 ring-white/30`}
      >
        <div className="absolute inset-x-[22%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/60" />
        <div className="absolute left-[18%] top-[14%] h-[22%] w-[32%] rounded-full bg-white/45 blur-[1px]" />
      </div>
    </div>
  );
}

/**
 * Decorative floating tablets behind the hero, with gentle float animation and
 * scroll parallax at different rates.
 */
export function FloatingTablets() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 900], [0, -160]);
  const y2 = useTransform(scrollY, [0, 900], [0, -80]);
  const y3 = useTransform(scrollY, [0, 900], [0, -220]);
  const y4 = useTransform(scrollY, [0, 900], [0, -120]);
  const r1 = useTransform(scrollY, [0, 900], [0, 40]);
  const r2 = useTransform(scrollY, [0, 900], [0, -50]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* soft glows */}
      <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-100/40 blur-3xl" />

      <motion.div style={{ y: y1, rotate: r1 }} className="absolute left-[8%] top-[18%]">
        <motion.div animate={{ y: [0, -18, 0], rotate: [-6, -10, -6] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
          <Capsule className="h-14 w-32 rotate-[-18deg]" tint="teal" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: y3 }} className="absolute right-[10%] top-[14%]">
        <motion.div animate={{ y: [0, 16, 0], rotate: [8, 12, 8] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}>
          <RoundTablet className="h-16 w-16" tint="sky" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: y2, rotate: r2 }} className="absolute left-[16%] bottom-[16%]">
        <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <RoundTablet className="h-12 w-12" tint="amber" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: y4 }} className="absolute right-[14%] bottom-[20%]">
        <motion.div animate={{ y: [0, 18, 0], rotate: [20, 26, 20] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}>
          <Capsule className="h-12 w-28 rotate-[24deg]" tint="emerald" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: y2 }} className="absolute left-[30%] top-[8%]">
        <motion.div animate={{ y: [0, -22, 0], rotate: [4, 8, 4] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}>
          <RoundTablet className="h-10 w-10" tint="emerald" />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: y1 }} className="absolute right-[28%] top-[60%]">
        <motion.div animate={{ y: [0, 14, 0], rotate: [-12, -16, -12] }} transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}>
          <RoundTablet className="h-11 w-11" tint="teal" />
        </motion.div>
      </motion.div>
    </div>
  );
}
