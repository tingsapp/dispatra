import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { companySettingsKey, useWorkspaceAccount, type SettingsView } from './WorkspaceAccount';
import { useOperationKey } from './ui';
import { useSettingsGuard } from '../components/settings/useSettingsGuard';

/** A versioned draft of the live company settings; each editor saves independently. */
export function useSettingsDraft() {
  const workspace = useWorkspaceAccount()!;
  const { settings, account } = workspace;
  const [baseline, setBaseline] = useState(settings);
  const [data, setData] = useState(settings.data);
  const [error, setError] = useState<unknown>();
  const dirty = JSON.stringify(data) !== JSON.stringify(baseline.data);
  const cache = useQueryClient();
  const key = useOperationKey();
  useSettingsGuard(dirty);
  const reset = (saved: SettingsView) => { setBaseline(saved); setData(saved.data); };
  useEffect(() => { if (!dirty && settings.version !== baseline.version) reset(settings); }, [settings, dirty, baseline.version]);
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { version: baseline.version, data: { ...data,
        gst_percent: !data.gst_enabled && data.gst_percent === '' ? '0' : data.gst_percent,
        provincial_percent: !data.provincial_enabled && data.provincial_percent === '' ? '0' : data.provincial_percent,
      } };
      return api.saveCompanySettings(account.organization!.slug, payload, key(payload));
    },
    onSuccess: saved => {
      reset(saved);
      cache.setQueryData(companySettingsKey(account.organization!.slug), saved);
      void cache.invalidateQueries({ queryKey: ['account'] });
    },
  });
  return { account, data, dirty, pending: mutation.isPending,
    patch: (change: Partial<typeof data>) => { setData(old => ({ ...old, ...change })); setError(undefined); mutation.reset(); },
    save: () => { setError(undefined); mutation.mutate(); },
    error: error || mutation.error,
    saved: mutation.isSuccess && !dirty,
    reload: async () => { try { reset(await workspace.reload()); setError(undefined); mutation.reset(); } catch (e) { setError(e); } },
  };
}
