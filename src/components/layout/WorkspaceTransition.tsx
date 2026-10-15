import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useWorkspaceModeTransition } from '../integrations/connectors/useWorkspaceModeTransition';
import { WorkspaceSwitchLoader } from '../integrations/connectors/WorkspaceSwitchLoader';

const Context = createContext<ReturnType<typeof useWorkspaceModeTransition> | null>(null);
export const useWorkspaceTransition = () => useContext(Context);

export function WorkspaceTransition({ nativeTms, children }: { nativeTms: boolean; children: ReactNode }) {
  const transition = useWorkspaceModeTransition(nativeTms);
  const { displayedMode, phase } = transition;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (phase !== 'idle' || displayedMode !== nativeTms || !restoreFocus.current) return;
    const frame = window.requestAnimationFrame(() => {
      const checkbox = surfaceRef.current?.querySelector<HTMLInputElement>('[data-workspace-mode-toggle]');
      if (checkbox && !checkbox.disabled) { checkbox.focus({ preventScroll: true }); restoreFocus.current = false; }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, nativeTms, displayedMode]);
  return <Context.Provider value={transition}>
    <div className="relative h-dvh bg-app-canvas">
      <div ref={surfaceRef} className="workspace-transition-surface h-full" data-transition={phase} data-mode={displayedMode ? 'dispatra' : 'external'} inert={phase !== 'idle'} aria-busy={phase !== 'idle'} onChangeCapture={event => {
        if (event.target instanceof HTMLElement && event.target.hasAttribute('data-workspace-mode-toggle')) restoreFocus.current = true;
      }}>{children}</div>
      {phase !== 'idle' && <WorkspaceSwitchLoader active={phase === 'loading'} />}
    </div>
  </Context.Provider>;
}
