import { confirmDialog } from '../components/ui/ConfirmDialog';
import { connectors } from '../integrations/connectors';
import { api } from '../portal/api';
import type { SettingsView } from '../portal/WorkspaceAccount';
import { TMS_INTEGRATION_LABEL } from '../lib/workspaceEntry';

export const AUTO_DISPATCH_UNAVAILABLE = `Auto dispatch cannot be turned on because this account uses an External TMS, “${TMS_INTEGRATION_LABEL}” is unchecked, and no TMS connector is connected. Open Integration to connect your TMS, or check “${TMS_INTEGRATION_LABEL}” to manage operations in Dispatra.`;

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
      if (!await confirmDialog({ title: 'Turn on auto dispatch?', message: 'Priced orders that are due soon will be assigned to the best available driver automatically. You will be notified of each assignment and of any order no driver can take.', confirmLabel: 'Turn on' })) return null;
    } else if (!await confirmDialog({ title: 'Turn off auto dispatch?', message: 'Orders will no longer be assigned automatically. New orders will wait until a dispatcher assigns a driver.', confirmLabel: 'Turn off' })) return null;
    return await api.saveCompanySettings(slug, { version: current.version, data: { ...current.data, dispatch_mode: mode } }, crypto.randomUUID());
  } catch (error) {
    if (mode === 'MANUAL') throw error;
    await confirmDialog({ title: 'Auto dispatch could not be turned on', message: error instanceof Error ? error.message : 'Could not verify your TMS connection. Try again.', confirmLabel: null, cancelLabel: null });
    return null;
  }
}
