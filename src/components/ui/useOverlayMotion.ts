import { useReducedMotion } from 'motion/react';

/** The same restrained entrance/exit for floating surfaces, respecting OS motion preferences. */
export function useOverlayMotion() {
  const reduced = useReducedMotion();
  return {
    initial: { opacity: 0, scale: reduced ? 1 : .985, y: reduced ? 0 : 3 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: reduced ? 1 : .985, y: reduced ? 0 : 2 },
    transition: { duration: reduced ? 0 : .16, ease: [.2, .8, .2, 1] as const },
  };
}
