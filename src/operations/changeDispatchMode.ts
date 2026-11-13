import { confirmDialog } from '../components/ui/ConfirmDialog';
import { connectors } from '../integrations/connectors';
import { api } from '../portal/api';
import type { SettingsView } from '../portal/WorkspaceAccount';
import { TMS_INTEGRATION_LABEL } from '../lib/workspaceEntry';

export const AUTO_DISPATCH_UNAVAILABLE = `Auto dispatch needs a connected TMS or “${TMS_INTEGRATION_LABEL}” turned on. Set this under Integration.`;

/** Confirm every mode change; check current connection state before asking to enable AUTO; the API revalidates on save. */
export async function changeDispatchMode(slug: string, current: SettingsView, mode: 'AUTO' | 'MANUAL', openIntegration: () => void): Promise<SettingsView | null> {
  if (mode === current.data.dispatch_mode) return null;
  try {
    if (mode === 'AUTO') {
      if (current.data.tms_workspace) {
        const rows = await connectors.list(slug);
        if (!rows.some(row => row.id !== 'samsara' && row.ready && (row.status === 'CONNECTED' || (row.status === 'SYNCING' && !!row.last_sync_at)))) {
          if (await confirmDialog({ title: 'Auto dispatch unavailable', message: AUTO_DISPATCH_UNAVAILABLE, confirmLabel: 'Open Integration', cancelLabel: null })) openIntegration();
          return null;
        }
      }
      if (!await confirmDialog({ title: 'Turn on auto dispatch?', message: 'Priced orders due soon go to the best available driver. You’ll be notified of each one.', confirmLabel: 'Turn on' })) return null;
    } else if (!await confirmDialog({ title: 'Turn off auto dispatch?', message: 'New orders will wait for a dispatcher to assign them.', confirmLabel: 'Turn off' })) return null;
    return await api.saveCompanySettings(slug, { version: current.version, data: { ...current.data, dispatch_mode: mode } }, crypto.randomUUID());
  } catch (error) {
    if (mode === 'MANUAL') throw error;
    await confirmDialog({ title: 'Auto dispatch could not be turned on', message: error instanceof Error ? error.message : 'Could not verify your TMS connection. Try again.', confirmLabel: null, cancelLabel: null });
    return null;
  }
}
