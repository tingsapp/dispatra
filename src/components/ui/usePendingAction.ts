import { useRef, useState } from 'react';

/** Prevent duplicate submissions and release the button after success or failure. */
export function usePendingAction() {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const run = async <T,>(action: () => T | Promise<T>, key?: string): Promise<T | undefined> => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setPendingKey(key ?? null);
    try { return await action(); }
    finally { running.current = false; setPending(false); setPendingKey(null); }
  };
  return { pending, pendingKey, run };
}
