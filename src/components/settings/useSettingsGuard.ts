import { useEffect } from 'react';
import { confirmDialog } from '../ui/ConfirmDialog';

export const SETTINGS_NAVIGATION_EVENT = 'dispatra:settings-navigation';
export const DISCARD_CHANGES = { title: 'Discard unsaved changes?', message: 'Your edits on this page have not been saved. Leaving now will throw them away.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', tone: 'danger' as const };

/** While a settings page is dirty, navigation events are cancelled and only proceed after the user confirms. */
export function useSettingsGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const navigate = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const proceed = (event as CustomEvent<{ proceed?: () => void }>).detail?.proceed;
      if (proceed) confirmDialog(DISCARD_CHANGES).then(ok => { if (ok) proceed(); });
    };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener(SETTINGS_NAVIGATION_EVENT, navigate);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener(SETTINGS_NAVIGATION_EVENT, navigate);
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty]);
}
