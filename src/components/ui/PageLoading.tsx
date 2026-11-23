import { useEffect, useRef } from 'react';

declare global { interface Window { DispatraPulse?: { mount: (host: HTMLElement) => () => void } } }

/** Shared startup screen for pages and workspaces: the Dispatra pulse (public/dispatra-pulse.js) above the status text. */
export function PageLoading({ children }: { children: string }) {
  const pulse = useRef<HTMLDivElement>(null);
  useEffect(() => pulse.current ? window.DispatraPulse?.mount(pulse.current) : undefined, []);
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-app-canvas px-6 text-center text-app-text">
    <div ref={pulse} aria-hidden="true" className="w-[132px]" />
    <p role="status" className="text-sm text-app-muted">{children}</p>
  </main>;
}
