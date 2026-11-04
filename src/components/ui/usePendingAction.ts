import { useRef, useState } from 'react';

/** Prevent duplicate submissions and release the button after success or failure. */
export function usePendingAction() {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const run = async <T,>(action: () => T | Promise<T>): Promise<T | undefined> => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try { return await action(); }
    finally { running.current = false; setPending(false); }
  };
  return { pending, run };
}
