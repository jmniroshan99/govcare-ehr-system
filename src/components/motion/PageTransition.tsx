import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, delay = 0.04 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { delayChildren: reduce ? 0 : delay, staggerChildren: reduce ? 0 : 0.04 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.24, ease: easeOut } },
      }}
      transition={{ duration: reduce ? 0 : 0.16, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function SectionReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduce ? 0 : 0.24, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function SwitchPanel({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
